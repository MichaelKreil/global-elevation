'use strict'

import { existsSync, fstat, mkdirSync, readFileSync, writeFileSync } from 'fs';
import zlib from 'zlib';
import { dirname, resolve } from 'path';
import { CACHE_FOLDER } from './helper.mjs';

export class AbstractDEM {
	#blockCache = new Map();
	#cacheFolder;
	constructor () {
		this.#cacheFolder = resolve(CACHE_FOLDER, this.constructor.name);
		if (!existsSync(this.#cacheFolder)) mkdirSync(this.#cacheFolder);

	}
	async getElevation(lng, lat) {
		let block;
		let blockId = this.getBlockId(lng, lat);
		if (this.#blockCache.has(blockId)) {
			block = this.#blockCache.get(blockId);
		} else {
			let filename = this.#getCachedFilename(blockId+'.br');
			if (!existsSync(filename)) {
				await this.generateBlock(filename, lng, lat);
			}
			block = Block.load(filename);
			this.#blockCache.set(blockId, block)
		}
		block.counter++;
		block.getElevation(lng, lat);
	}
	#getCachedFilename(filename) {
		return resolve(this.#cacheFolder, filename);
	}
}

export class Block {
	constructor(width, height, data, projection) {
		if (data.length !== width*height) throw Error('wrong size');
		this.width = width;
		this.height = height;
		this.data = data;
		this.projection = projection;
	}
	save(filename) {
		let obj = {
			width: this.width,
			height: this.height,
			projection: this.projection,
			type: this.data.constructor.name,
		}
		obj = Buffer.from(JSON.stringify(obj));
		let buffers = [
			Buffer.from((new Uint32Array([obj.length])).buffer),
			obj,
			Buffer.from(this.data.buffer),
		]
		buffers = Buffer.concat(buffers);

		buffers = zlib.brotliCompressSync(buffers, { params: {
			[zlib.constants.BROTLI_PARAM_QUALITY]: 5,
			[zlib.constants.BROTLI_PARAM_SIZE_HINT]: buffers.length
		}});

		writeFileSync(filename, buffers);
	}
	getElevation(lng, lat) {
		let x = Math.floor(lng*this.projection.xs + this.projection.x0);
		let y = Math.floor(lat*this.projection.ys + this.projection.y0);
		if (x < 0) x = 0;
		if (y < 0) y = 0;
		if (x >= this.width)  x = this.width-1;
		if (y >= this.height) y = this.height-1;
		let index = x + y*this.width;
		return this.data[index];
	}
	static load(filename) {
		let buffer = readFileSync(filename);
		buffer = zlib.brotliDecompressSync(buffer);
		let headerSize = buffer.readUInt32LE(0);
		let header = JSON.parse(buffer.subarray(4, 4+headerSize));
		let imageData = buffer.buffer.slice(4+headerSize);

		let ArrayType;
		switch (header.type) {
			case 'UInt16Array': ArrayType = Uint16Array; break;
			case  'Int16Array': ArrayType =  Int16Array; break;
			case 'UInt32Array': ArrayType = Uint32Array; break;
			case  'Int32Array': ArrayType =  Int32Array; break;
			default: console.log({tags}); throw Error();
		}

		let data = new ArrayType(imageData);

		return new Block(header.width, header.height, data, header.projection);
	}
	getProjection() {
		return this.projection;
	}
	static fromGeoTiff(buffer) {
		// https://web.archive.org/web/20180810205359/https://www.adobe.io/content/udp/en/open/standards/TIFF/_jcr_content/contentbody/download/file.res/TIFF6.pdf

		bufferWrapper(buffer);

		if (buffer.getHex(0,4) !== '49492a00') throw Error('GeoTiff: wrong header');
		return getIFD(buffer.getUInt32(4));

		function getIFD(offsetIFD) {
			let sliceIFD = bufferWrapper(buffer.subarray(offsetIFD));
			let count = sliceIFD.getUInt16(0);
			let ifdEntries = new Array(count);
			let tags = {};

			for (let i = 0; i < count; i++) {
				let sliceEntry = bufferWrapper(sliceIFD.subarray(i*12+2));
				let entry = ifdEntries[i] = {
					tag: sliceEntry.getUInt16(0),
					type: sliceEntry.getUInt16(2),
					count: sliceEntry.getUInt32(4),
					offset: sliceEntry.getUInt32(8)
				}

				processIFDEntryType(entry);
				processIFDEntryTag(entry, tags);
				
				if ((i > 0) && (ifdEntries[i].tag <= ifdEntries[i-1].tag)) throw Error();
			}

			let ArrayType, bytesPerSample;
			switch (tags.sampleFormat+'/'+tags.bitsPerSample) {
				case '1/16': bytesPerSample = 2; ArrayType = Uint16Array; break;
				case '2/16': bytesPerSample = 2; ArrayType =  Int16Array; break;
				default: console.log({tags}); throw Error();
			}
			let bytesPerPixel = bytesPerSample * tags.samplePerPixel;
			let bytesPerStrip = bytesPerPixel * tags.imageWidth * tags.rowsPerStrip;
			let imageBuffer = Buffer.alloc(tags.imageWidth * tags.imageHeight * bytesPerPixel);
			for (let stripIndex = 0; stripIndex < tags.stripOffsets.length; stripIndex++) {
				let stripOffset = tags.stripOffsets[stripIndex];
				let stripByteCount = tags.stripByteCounts[stripIndex];
				let strip = buffer.subarray(stripOffset, stripOffset+stripByteCount);
				switch (tags.compression) {
					case 1: break; // no compression
					default: console.log({tags}); throw Error();
				}
				strip.copy(imageBuffer, stripIndex*bytesPerStrip);
			}
			let imageData = new ArrayType(imageBuffer.buffer);
			
			return new Block(tags.imageWidth, tags.imageHeight, imageData, getProjection(tags));
		}

		function bufferWrapper(buffer) {
			buffer.getHex = function getHex(offset, length) {
				return buffer.subarray(offset, offset + length).toString('hex');
			}
			buffer.getUInt16 = function getUInt16(offset) {
				return buffer.readUInt16LE(offset);
			}
			buffer.getUInt32 = function getUInt32(offset) {
				return buffer.readUInt32LE(offset);
			}
			buffer.getDouble = function getDouble(offset) {
				return buffer.readDoubleLE(offset);
			}
			return buffer;
		}

		function processIFDEntryType(entry) {
			switch (entry.type) {
				case  1: entry.typeName = 'BYTE'; break;
				case  2: entry.typeName = 'ASCII'; break;
				case  3: entry.typeName = 'SHORT'; break;
				case  4: entry.typeName = 'LONG'; break;
				case  5: entry.typeName = 'RATIONAL'; break;
				case  6: entry.typeName = 'SBYTE'; break;
				case  7: entry.typeName = 'UNDEFINED'; break;
				case  8: entry.typeName = 'SSHORT'; break;
				case  9: entry.typeName = 'SLONG'; break;
				case 10: entry.typeName = 'SRATIONAL'; break;
				case 11: entry.typeName = 'FLOAT'; break;
				case 12: entry.typeName = 'DOUBLE'; break;
				default: throw Error()
			}
		}

		function processIFDEntryTag(entry, tags) {
			switch (entry.tag) {
				case   256: return tags.imageWidth = getValue();
				case   257: return tags.imageHeight = getValue();
				case   258: return tags.bitsPerSample = getValue();
				case   259: return tags.compression = getValue();
				case   262: return;
				case   273: return tags.stripOffsets = getArray();
				case   274: return tags.orientation = getValue();
				case   277: return tags.samplePerPixel = getValue();
				case   278: return tags.rowsPerStrip = getValue();
				case   279: return tags.stripByteCounts = getArray();
				case   282: return tags.xResolution = getValue();
				case   283: return tags.yResolution = getValue();
				case   284: return tags.planarConfiguration = getValue();
				case   296: return tags.resolutionUnit = getValue();
				case   305: return tags.software = getArray();
				case   339: return tags.sampleFormat = getValue();
				case 33550: return tags.modelPixelScale = getArray();
				case 33922: return tags.modelTiepoint = getArray();
				case 34264: return tags.modelTransformation = getValue();
				case 34735: return tags.geoKeyDirectory = getArray();
				case 34736: return tags.geoDoubleParams = getArray();
				case 34737: return tags.geoAsciiParams = getArray();
				default: throw Error('GeoTiff: unknown tag: '+entry.tag)
			}

			function getValue() {
				if (entry.count !== 1) throw Error('GeoTiff: Maybe I am a array?');

				switch (entry.type) {
					case  3: return entry.offset;
					case  4: return entry.offset;
					case  5: return buffer.getUInt32(entry.offset)/buffer.getUInt32(entry.offset+4);
					case 12: return buffer.getDouble(entry.offset);
					default:
						console.log(entry);
						throw Error('GeoTiff: Do not know how to handle value type '+entry.type)
				}
			}

			function getArray() {
				let array = new Array(entry.count);
				switch (entry.type) {
					case  2:
						return buffer.subarray(entry.offset, entry.offset + entry.count).toString();
					case  3:
						for (let i = 0; i < entry.count; i++) array[i] = buffer.readUInt16LE(entry.offset + i * 2);
						return array;
					case  4:
						for (let i = 0; i < entry.count; i++) array[i] = buffer.readUInt32LE(entry.offset + i * 4);
						return array;
					case 12:
						for (let i = 0; i < entry.count; i++) array[i] = buffer.readDoubleLE(entry.offset + i * 8);
						return array;
					default:
						console.log(entry);
						throw Error('GeoTiff: Do not know how to handle array type '+entry.type)
				}
			}
		}

		function getProjection(tags) {
			// http://docs.opengeospatial.org/is/19-008r4/19-008r4.html#_geotiff_tags_for_coordinate_transformations
			if (tags.modelTransformation) throw Error('GeoTiff: not implementation for tags.modelTransformation = '+tags.modelTransformation);
			if (tags.modelPixelScale.length !== 3) throw Error('GeoTiff: not implementation for tags.modelPixelScale.length = '+tags.modelPixelScale.length);
			if (tags.modelTiepoint.length !== 6) throw Error('GeoTiff: not implementation for tags.modelTiepoint.length = '+tags.modelTiepoint.length);
			if (tags.orientation !== 1) throw Error('GeoTiff: not implementation for tags.orientation = '+tags.orientation);
			if (tags.modelTiepoint[0] !== 0) throw Error('GeoTiff: not implementation for tags.modelTiepoint[0] = '+tags.modelTiepoint[0]);
			if (tags.modelTiepoint[1] !== 0) throw Error('GeoTiff: not implementation for tags.modelTiepoint[1] = '+tags.modelTiepoint[1]);

			return {
				type: 'simple',
				x0: - tags.modelTiepoint[3] / tags.modelPixelScale[0] + tags.modelTiepoint[0],
				y0: + tags.modelTiepoint[4] / tags.modelPixelScale[1] + tags.modelTiepoint[1],
				xs: + 1 / tags.modelPixelScale[0],
				ys: - 1 / tags.modelPixelScale[1],
			}
		}
	}
}
