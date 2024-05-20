import { Address, toNano } from '@ton/core';
import { SimpleContract } from '../wrappers/SimpleContract';
import { NetworkProvider, compile, sleep } from '@ton/blueprint';

export async function run(provider: NetworkProvider, args: string[]) {
    const ui = provider.ui();

    const address = Address.parse(args.length > 0 ? args[0] : await ui.input('SimpleContract address'));

    if (!(await provider.isContractDeployed(address))) {
        ui.write(`Error: Contract at address ${address} is not deployed!`);
        return;
    }

    const simpleContract = provider.open(SimpleContract.createFromAddress(address));

    const counterBefore = await simpleContract.getCounter();

    await simpleContract.sendUpgrade(provider.sender(), {
        code: await compile('SimpleContractV2'),
        value: toNano('0.05'),
    });

    ui.write('Waiting for contract to upgrade...');

    // Decrease counter
    await simpleContract.sendDecrease(provider.sender(), {
        decreaseBy: args.length > 1 ? parseInt(args[1]) : Number(await ui.input('Decrease by')),
        value: toNano('0.05'),
    });

    let counterAfter = await simpleContract.getCounter();
    let attempt = 1;
    while (counterAfter === counterBefore) {
        ui.setActionPrompt(`Attempt ${attempt}`);
        await sleep(2000);
        counterAfter = await simpleContract.getCounter();
        attempt++;
    }

    ui.clearActionPrompt();
    ui.write('Counter decrease successfully!');
}
