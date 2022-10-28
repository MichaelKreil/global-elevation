'use strict'

import { createWriteStream, existsSync, fstat, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import * as http from 'node:http';
import * as https from 'node:https';

const __filename = fileURLToPath(import.meta.url);
const TEMP_FOLDER = resolve(dirname(__filename), '../tmp');

export const CACHE_FOLDER = TEMP_FOLDER;
export const DOWNLOAD_FOLDER = resolve(TEMP_FOLDER, 'download');

[CACHE_FOLDER, DOWNLOAD_FOLDER].forEach(folder => {
	if (existsSync(folder)) return;
	mkdirSync(folder, { recursive: true });
})

export function getTempFilename(filename) {
	return resolve(DOWNLOAD_FOLDER, filename);
}

export async function download(url, filename) {
	let redirectCount = 0;
	return new Promise((res, rej) => {
		let urlParsed = new URL(url);

		let lib;
		switch (urlParsed.protocol) {
			case 'http:':  lib = http;  break;
			case 'https:': lib = https; break;
			default: throw Error('unknown protocol ' + urlParsed.protocol);
		}

		lib.get(url, async response => {
			if (response.statusCode === 200) {
				response
					.pipe(createWriteStream(filename))
					.on('close', () => res());
				return
			}

			if (response.statusCode === 302) {
				// redirect
				redirectCount++;
				if (redirectCount > 10) throw Error('too many redirects');
				await download(response.headers.location, filename);
				return res();
			}

			console.log({headers: response.headers});
			throw Error('unknown status code ' + response.statusCode)
		})
	})
}
