import { toNano } from '@ton/core';
import { SimpleContract } from '../wrappers/SimpleContract';
import { compile, NetworkProvider } from '@ton/blueprint';

export async function run(provider: NetworkProvider) {
    const simpleContract = provider.open(
        SimpleContract.createFromConfig(
            {
                id: Math.floor(Math.random() * 10000),
                counter: 0,
            },
            await compile('SimpleContract')
        )
    );

    await simpleContract.sendDeploy(provider.sender(), toNano('0.05'));

    await provider.waitForDeploy(simpleContract.address);

    console.log('ID', await simpleContract.getID());
}
