# Global Elevation

Get the elevation for every point on earth.

## Install

```bash
npm i global-elevation 
```

## Usage

```javascript
const { ETOPO5 } = await import('global-elevation');
let etopo5 = new ETOPO5();
let elevation = await etopo5.getElevation(13.4083, 52.5186);
```

This will create a `tmp` folder, download the data from the source and pre-process it.
Note that this may take a few minutes... but only for the first query. Subsequent queries will be extremely fast.
So the best use case for this lib is if you want the heights of thousands/millions of points.

## Sources:

| implemented | name       | source                                                                                |
|-------------|------------|---------------------------------------------------------------------------------------|
| ✅           | ETOPO1     | [ETOPO1](https://www.ngdc.noaa.gov/mgg/global/)                                       |
| ✅           | ETOPO5     | [ETOPO5](https://data.europa.eu/data/datasets/dat-92-en)                              |
| -           | Copernicus | [Copernicus](https://registry.opendata.aws/copernicus-dem/)                           |
| -           | CEDTM      | [CEDTM - Continental Europe Digital Terrain Model](https://zenodo.org/record/4724549) |
| -           | NASADEM    | [NASADEM_HGT](https://e4ftl01.cr.usgs.gov/MEASURES/NASADEM_HGT.001/2000.02.11/)       |
