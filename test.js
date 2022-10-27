'use strict'

start();

async function start() {
	const { ETOPO5 } = await import('./index.mjs');
	let etopo5 = new ETOPO5();
	let elevation = await etopo5.getElevation(13.4083, 52.5186);
}
