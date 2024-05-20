import { Address, beginCell, Cell, Contract, contractAddress, ContractProvider, Sender, SendMode } from '@ton/core';

export type SimpleContractConfig = {
    id: number;
    counter: number;
};

export function simpleContractConfigToCell(config: SimpleContractConfig): Cell {
    return beginCell().storeUint(config.id, 32).storeUint(config.counter, 32).endCell();
}

export const Opcodes = {
    increase: 0x7e8764ef,
    decrease: 0xe78525c4,
    upgrade: 0xdbfaf817,
    upgradeAll: 0xff382702,
};

export class SimpleContract implements Contract {
    constructor(
        readonly address: Address,
        readonly init?: { code: Cell; data: Cell },
    ) {}

    static createFromAddress(address: Address) {
        return new SimpleContract(address);
    }

    static createFromConfig(config: SimpleContractConfig, code: Cell, workchain = 0) {
        const data = simpleContractConfigToCell(config);
        const init = { code, data };
        return new SimpleContract(contractAddress(workchain, init), init);
    }

    async sendDeploy(provider: ContractProvider, via: Sender, value: bigint) {
        await provider.internal(via, {
            value,
            sendMode: SendMode.PAY_GAS_SEPARATELY,
            body: beginCell().endCell(),
        });
    }

    async sendIncrease(
        provider: ContractProvider,
        via: Sender,
        opts: {
            increaseBy: number;
            value: bigint;
            queryID?: number;
        },
    ) {
        await provider.internal(via, {
            value: opts.value,
            sendMode: SendMode.PAY_GAS_SEPARATELY,
            body: beginCell()
                .storeUint(Opcodes.increase, 32)
                .storeUint(opts.queryID ?? 0, 64)
                .storeUint(opts.increaseBy, 32)
                .endCell(),
        });
    }

    async sendDecrease(
        provider: ContractProvider,
        via: Sender,
        opts: {
            decreaseBy: number;
            value: bigint;
            queryID?: number;
        },
    ) {
        await provider.internal(via, {
            value: opts.value,
            sendMode: SendMode.PAY_GAS_SEPARATELY,
            body: beginCell()
                .storeUint(Opcodes.decrease, 32)
                .storeUint(opts.queryID ?? 0, 64)
                .storeUint(opts.decreaseBy, 32)
                .endCell(),
        });
    }

    // upgrade code only
    async sendUpgrade(
        provider: ContractProvider,
        via: Sender,
        opts: {
            value: bigint;
            queryID?: number;
            code: Cell;
        },
    ) {
        await provider.internal(via, {
            value: opts.value,
            sendMode: SendMode.PAY_GAS_SEPARATELY,
            body: beginCell()
                .storeUint(Opcodes.upgrade, 32)
                .storeUint(opts.queryID ?? 0, 64)
                .storeRef(opts.code)
                .endCell(),
        });
    }

    // upgrade code and data
    async sendUpgradeAll(
        provider: ContractProvider,
        via: Sender,
        opts: {
            value: bigint;
            queryID?: number;
            code: Cell;
            data: Cell;
        },
    ) {
        await provider.internal(via, {
            value: opts.value,
            sendMode: SendMode.PAY_GAS_SEPARATELY,
            body: beginCell()
                .storeUint(Opcodes.upgradeAll, 32)
                .storeUint(opts.queryID ?? 0, 64)
                .storeRef(opts.code)
                .storeRef(opts.data)
                .endCell(),
        });
    }

    async getCounter(provider: ContractProvider) {
        const result = await provider.get('get_counter', []);
        return result.stack.readNumber();
    }

    async getID(provider: ContractProvider) {
        const result = await provider.get('get_id', []);
        return result.stack.readNumber();
    }
}
