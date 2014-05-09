import IWellcomeProvider = require("../../modules/wellcomeplayer-shared-module/iWellcomeProvider");
import IPDFProvider = require("../coreplayer-pdf-extension/iPDFProvider");

interface IWellcomePDFProvider extends IWellcomeProvider, IPDFProvider{
    getSaveInfo(path: string, thumbnail: string, title: string): any;
    getThumbUri(): string;
}

export = IWellcomePDFProvider;