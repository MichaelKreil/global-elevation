'use strict'

import { AbstractDEM, Block } from './abstract_dem.mjs';
import { download, getTempFilename } from './helper.mjs';
import { rmSync } from 'fs';

import AdmZip from 'adm-zip';

export class ETOPO5 extends AbstractDEM {
	getBlockId(lng, lat) {
		return 'world';
	}
	async generateBlock(filename, lng, lat) {
		let zipFilename = getTempFilename('etopo5.zip');
		await download('https://www.eea.europa.eu/data-and-maps/data/world-digital-elevation-model-etopo5/zipped-dem-geotiff-raster-geographic-tag-image-file-format-raster-data/zipped-dem-geotiff-raster-geographic-tag-image-file-format-raster-data/at_download/file', zipFilename)
		let zipFile = new AdmZip(zipFilename);
		let tiff = zipFile.getEntries().find(e => e.name === 'alwdgg.tif');
		let block = Block.fromGeoTiff(tiff.getData());
		block.save(filename);
		rmSync(zipFilename);
		return block;
	}
}

