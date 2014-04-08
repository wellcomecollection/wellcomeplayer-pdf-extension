
import IPDFProvider = require("../coreplayer-pdf-extension/iPDFProvider");

interface IWellcomePDFProvider extends IPDFProvider{
    getSaveInfo(path: string, thumbnail: string, title: string): any;
    getThumbUri(): string;
}

export = IWellcomePDFProvider;