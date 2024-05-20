import { Blockchain, SandboxContract, TreasuryContract } from '@ton/sandbox';
import { Cell, beginCell, toNano } from '@ton/core';
import { Opcodes, SimpleContract } from '../wrappers/SimpleContract';
import '@ton/test-utils';
import { compile } from '@ton/blueprint';

describe('SimpleContract', () => {
    let code: Cell;
    let codeV2: Cell; // SimpleContractV2 has decrease method
    let codeV3: Cell; // SimpleContractV3 has decrease method and ownable feature

    beforeAll(async () => {
        code = await compile('SimpleContract');
        codeV2 = await compile('SimpleContractV2');
        codeV3 = await compile('SimpleContractV3');
    });

    let blockchain: Blockchain;
    let deployer: SandboxContract<TreasuryContract>;
    let simpleContract: SandboxContract<SimpleContract>;

    beforeEach(async () => {
        blockchain = await Blockchain.create();

        simpleContract = blockchain.openContract(
            SimpleContract.createFromConfig(
                {
                    id: 0,
                    counter: 0,
                },
                code,
            ),
        );

        deployer = await blockchain.treasury('deployer');

        const deployResult = await simpleContract.sendDeploy(deployer.getSender(), toNano('0.05'));

        expect(deployResult.transactions).toHaveTransaction({
            from: deployer.address,
            to: simpleContract.address,
            deploy: true,
            success: true,
        });
    });

    it('should deploy', async () => {
        // the check is done inside beforeEach
        // blockchain and simpleContract are ready to use
    });

    it('should increase counter', async () => {
        const increaseTimes = 3;
        for (let i = 0; i < increaseTimes; i++) {
            const increaser = await blockchain.treasury('increaser' + i);
            const counterBefore = await simpleContract.getCounter();
            const increaseBy = Math.floor(Math.random() * 100);
            const increaseResult = await simpleContract.sendIncrease(increaser.getSender(), {
                increaseBy,
                value: toNano('0.05'),
            });
            expect(increaseResult.transactions).toHaveTransaction({
                from: increaser.address,
                to: simpleContract.address,
                success: true,
            });
            const counterAfter = await simpleContract.getCounter();
            expect(counterAfter).toBe(counterBefore + increaseBy);
        }
    });

    it('Should upgrade and decrease counter', async () => {
        // initialize contract with counter = 100
        const initCounter = 100;
        const increaser = await blockchain.treasury('increaser');
        const counterBefore = await simpleContract.getCounter();
        expect(counterBefore).toBe(0);
        await simpleContract.sendIncrease(increaser.getSender(), {
            increaseBy: initCounter,
            value: toNano('0.05'),
        });
        const counterAfter = await simpleContract.getCounter();
        expect(counterAfter).toBe(initCounter);

        // upgrade contract to SimpleContractV2
        const upgrader = await blockchain.treasury('upgrader');
        const upgradeResult = await simpleContract.sendUpgrade(upgrader.getSender(), {
            code: codeV2,
            value: toNano('0.05'),
        });
        expect(upgradeResult.transactions).toHaveTransaction({
            from: upgrader.address,
            to: simpleContract.address,
            success: true,
        });

        // try to decrease counter
        const decreaser = await blockchain.treasury('decreaser');
        const decreaseBy = 50;
        await simpleContract.sendDecrease(decreaser.getSender(), {
            decreaseBy,
            value: toNano('0.05'),
        });
        const counterAfterDecrease = await simpleContract.getCounter();
        expect(counterAfterDecrease).toBe(initCounter - decreaseBy);
    });

    it('Should upgrade code and override data', async () => {
        // initialize contract with counter = 100
        const initCounter = 100;
        const increaser = await blockchain.treasury('increaser');
        const counterBefore = await simpleContract.getCounter();
        expect(counterBefore).toBe(0);
        await simpleContract.sendIncrease(increaser.getSender(), {
            increaseBy: initCounter,
            value: toNano('0.05'),
        });
        const counterAfter = await simpleContract.getCounter();
        expect(counterAfter).toBe(initCounter);

        // upgrade contract to SimpleContractV3 and override counter to 10000
        const expectedCounter = 10000;
        const upgrader = await blockchain.treasury('upgrader');
        const upgradeResult = await simpleContract.sendUpgradeAll(upgrader.getSender(), {
            value: toNano('0.1'),
            code: codeV2,
            data: beginCell().storeUint(0, 32).storeUint(expectedCounter, 32).endCell(),
        });
        expect(upgradeResult.transactions).toHaveTransaction({
            from: upgrader.address,
            to: simpleContract.address,
            success: true,
        });

        // check counter
        const counterAfterUpgrade = await simpleContract.getCounter();
        expect(counterAfterUpgrade).toBe(expectedCounter);

        // try to decrease counter
        const decreaser = await blockchain.treasury('decreaser');
        const decreaseBy = 50;
        await simpleContract.sendDecrease(decreaser.getSender(), {
            decreaseBy,
            value: toNano('0.05'),
        });
        const counterAfterDecrease = await simpleContract.getCounter();
        expect(counterAfterDecrease).toBe(expectedCounter - decreaseBy);
    });

    it('Should upgrade code and migrate data with ownable feature enabled (V3)', async () => {
        // initialize contract with counter = 100
        const initCounter = 100;
        const increaser = await blockchain.treasury('increaser');
        const counterBefore = await simpleContract.getCounter();
        expect(counterBefore).toBe(0);
        await simpleContract.sendIncrease(increaser.getSender(), {
            increaseBy: initCounter,
            value: toNano('0.05'),
        });

        // upgrade contract to SimpleContractV3 and migrate counter to 10000
        const expectedCounter = 10000;
        const upgrader = await blockchain.treasury('upgrader');
        const upgradeResult = await simpleContract.sendUpgradeAll(upgrader.getSender(), {
            value: toNano('0.1'),
            code: codeV3,
            data: beginCell().storeUint(0, 32).storeUint(expectedCounter, 32).storeAddress(upgrader.address).endCell(),
        });
        expect(upgradeResult.transactions).toHaveTransaction({
            from: upgrader.address,
            to: simpleContract.address,
            success: true,
        });

        // decrease counter fails because of owner is upgrader
        const decreaser = await blockchain.treasury('decreaser');
        const decreaseBy = 50;
        const decreaseResult = await simpleContract.sendDecrease(decreaser.getSender(), {
            decreaseBy,
            value: toNano('0.05'),
        });
        expect(decreaseResult.transactions).toHaveTransaction({
            from: decreaser.address,
            to: simpleContract.address,
            op: Opcodes.decrease,
            success: false,
        });

        // decrease counter with upgrader
        const decreaseResult2 = await simpleContract.sendDecrease(upgrader.getSender(), {
            decreaseBy,
            value: toNano('0.05'),
        });
        expect(decreaseResult2.transactions).toHaveTransaction({
            from: upgrader.address,
            to: simpleContract.address,
            op: Opcodes.decrease,
            success: true,
        });
        const counterAfterDecrease = await simpleContract.getCounter();
        expect(counterAfterDecrease).toBe(expectedCounter - decreaseBy);
    });
});
