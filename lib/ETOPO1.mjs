'use strict'



import { existsSync, rmSync } from 'fs';
import AdmZip from 'adm-zip';
import { AbstractDEM, Block } from './abstract_dem.mjs';
import { download, getTempFilename } from './helper.mjs';



export class ETOPO1 extends AbstractDEM {
	getBlockId(lng, lat) {
		return 'world';
	}
	async generateBlock(filename, lng, lat) {
		let zipFilename = getTempFilename('etopo1.zip');
		if (!existsSync(zipFilename)) {
			await download('https://www.ngdc.noaa.gov/mgg/global/relief/ETOPO1/data/bedrock/cell_registered/georeferenced_tiff/ETOPO1_Bed_c_geotiff.zip', zipFilename)
		}
		let zipFile = new AdmZip(zipFilename);
		let tiff = zipFile.getEntries().find(e => e.name === 'ETOPO1_Bed_c_geotiff.tif');
		let block = Block.fromGeoTiff(tiff.getData());
		block.projection = { type: 'simple', x0: 10800, y0: 5400, xs: 60, ys: -60 };
		block.save(filename);
		rmSync(zipFilename);
		return block;
	}
}
