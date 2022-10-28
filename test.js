'use strict'

start();

async function start() {
	const { ETOPO1 } = await import('./index.mjs');
	let etopo1 = new ETOPO1();
	//let elevation = await etopo1.getElevation(13.4083, 52.5186); // 44
	let elevation = await etopo1.getElevation(86.92483, 27.98787); // 8848
	console.log(elevation);
}
