/// <reference path="../../js/jquery.d.ts" />
/// <reference path="../../js/extensions.d.ts" />

import baseExtension = require("../../modules/coreplayer-shared-module/baseExtension");
import coreExtension = require("../coreplayer-pdf-extension/extension");
import utils = require("../../utils");
import baseProvider = require("../../modules/coreplayer-shared-module/baseProvider");
import provider = require("./provider");
import shell = require("../../modules/coreplayer-shared-module/shell");
import header = require("../../modules/coreplayer-shared-module/headerPanel");
import left = require("../../modules/coreplayer-treeviewleftpanel-module/treeViewLeftPanel");
import right = require("../../modules/wellcomeplayer-moreinforightpanel-module/moreInfoRightPanel");
import footer = require("../../modules/wellcomeplayer-extendedfooterpanel-module/footerPanel");
import login = require("../../modules/wellcomeplayer-dialogues-module/loginDialogue");
import conditions = require("../../modules/wellcomeplayer-dialogues-module/conditionsDialogue");
import download = require("../../modules/wellcomeplayer-dialogues-module/downloadDialogue");
import center = require("../../modules/coreplayer-pdfcenterpanel-module/pdfCenterPanel");
import embed = require("../../extensions/coreplayer-pdf-extension/embedDialogue");
import help = require("../../modules/coreplayer-dialogues-module/helpDialogue");
import IWellcomeExtension = require("../../modules/wellcomeplayer-shared-module/iWellcomeExtension");
import sharedBehaviours = require("../../modules/wellcomeplayer-shared-module/behaviours");
import IProvider = require("../../modules/coreplayer-shared-module/iProvider");
import IWellcomeProvider = require("../../modules/wellcomeplayer-shared-module/iWellcomeProvider");
import IWellcomePDFProvider = require("./iWellcomePDFProvider");
import IWellcomePDFExtension = require("./iWellcomePDFExtension");

export class Extension extends coreExtension.Extension implements IWellcomePDFExtension{

    $conditionsDialogue: JQuery;
    conditionsDialogue: conditions.ConditionsDialogue;
    $loginDialogue: JQuery;
    loginDialogue: login.LoginDialogue;
    $downloadDialogue: JQuery;
    downloadDialogue: download.DownloadDialogue;
    $helpDialogue: JQuery;
    helpDialogue: help.HelpDialogue;
    $restrictedFileDialogue: JQuery;

    sessionTimer: any;

    static SAVE: string = 'onSave';

    behaviours: sharedBehaviours;

    constructor(provider: IProvider) {
        this.behaviours = new sharedBehaviours(this);

        super(provider);
    }

    create(): void {
        super.create();

        // track unload
        $(window).bind('unload', () => {
            //this.trackEvent("Documents", "Unloaded");
            $.publish(baseExtension.BaseExtension.WINDOW_UNLOAD);
        });

        $.subscribe(footer.FooterPanel.DOWNLOAD, (e) => {
            $.publish(download.DownloadDialogue.SHOW_DOWNLOAD_DIALOGUE);
        });

        $.subscribe(footer.FooterPanel.SAVE, (e) => {
            if (this.isFullScreen) {
                $.publish(baseExtension.BaseExtension.TOGGLE_FULLSCREEN);
            }
            this.save();
        });

        $.subscribe(login.LoginDialogue.LOGIN, (e, params: any) => {
            this.login(params);
        });
    }

    createModules(): void{
        this.headerPanel = new header.HeaderPanel(shell.Shell.$headerPanel);

        if (this.isLeftPanelEnabled()){
            this.leftPanel = new left.TreeViewLeftPanel(shell.Shell.$leftPanel);
        }

        this.centerPanel = new center.PDFCenterPanel(shell.Shell.$centerPanel);
        this.rightPanel = new right.MoreInfoRightPanel(shell.Shell.$rightPanel);
        this.footerPanel = new footer.FooterPanel(shell.Shell.$footerPanel);

        this.$conditionsDialogue = utils.Utils.createDiv('overlay conditions');
        shell.Shell.$overlays.append(this.$conditionsDialogue);
        this.conditionsDialogue = new conditions.ConditionsDialogue(this.$conditionsDialogue);

        this.$loginDialogue = utils.Utils.createDiv('overlay login');
        shell.Shell.$overlays.append(this.$loginDialogue);
        this.loginDialogue = new login.LoginDialogue(this.$loginDialogue);

        this.$embedDialogue = utils.Utils.createDiv('overlay embed');
        shell.Shell.$overlays.append(this.$embedDialogue);
        this.embedDialogue = new embed.EmbedDialogue(this.$embedDialogue);

        this.$downloadDialogue = utils.Utils.createDiv('overlay download');
        shell.Shell.$overlays.append(this.$downloadDialogue);
        this.downloadDialogue = new download.DownloadDialogue(this.$downloadDialogue);

        this.$helpDialogue = utils.Utils.createDiv('overlay help');
        shell.Shell.$overlays.append(this.$helpDialogue);
        this.helpDialogue = new help.HelpDialogue(this.$helpDialogue);
    }

    viewMedia(){

        var canvasIndex = 0;

        // authorise.
        this.viewIndex(canvasIndex, () => {

            var canvas = this.provider.sequence.assets[canvasIndex];

            // if the asset doesn't have multiple sources, do a prefetch
            if (!canvas.sources){
                // successfully authorised. prefetch asset.
                this.prefetchAsset(canvasIndex, () => {
                    // successfully prefetched.
                    this.provider.setMediaUri(canvas);
                    $.publish(Extension.OPEN_MEDIA, [canvas]);
                    this.setParam(baseProvider.params.canvasIndex, canvasIndex);
                    this.updateSlidingExpiration();
                });
            } else {
                this.provider.setMediaUri(canvas);
                $.publish(Extension.OPEN_MEDIA, [canvas]);
                this.setParam(baseProvider.params.canvasIndex, canvasIndex);
                this.updateSlidingExpiration();
            }

        });
    }

    save(): void {

        if (!this.isLoggedIn()) {
            this.showLoginDialogue({
                successCallback: () => {
                    this.save();
                },
                failureCallback: (message: string) => {
                    this.showDialogue(message, () => {
                        this.save();
                    });
                },
                allowClose: true,
                message: this.provider.config.modules.genericDialogue.content.loginToSave
            });
        } else if (this.isGuest()){
            this.showLoginDialogue({
                successCallback: () => {
                    this.save();
                },
                failureCallback: (message: string) => {
                    this.showDialogue(message, () => {
                        this.save();
                    });
                },
                allowClose: true,
                allowSocialLogin: true
            });
        } else {
            var path = (<IWellcomeProvider>this.provider).getSaveUri();
            var thumbnail =  (<IWellcomePDFProvider>this.provider).getThumbUri(this.provider.getCanvasByIndex(0));
            var title = this.provider.getTitle();

            var info = (<IWellcomePDFProvider>this.provider).getSaveInfo(path, thumbnail, title);
            this.triggerSocket(Extension.SAVE, info);
        }
    }

    setParams(): void{
        if (!this.provider.isHomeDomain) return;

        // check if there are legacy params and reformat.
        // if the string isn't empty and doesn't contain a ? sign it's a legacy hash.
        var hash = parent.document.location.hash;

        if (hash != '' && !hash.contains('?')){
            // split params on '/'.
            var params = hash.replace('#', '').split('/');

            // reset hash to empty.
            parent.document.location.hash = '';

            // sequenceIndex
            if (params[0]){
                this.setParam(baseProvider.params.sequenceIndex, this.provider.sequenceIndex);
            }

            // canvasIndex
            if (params[1]){
                this.setParam(baseProvider.params.canvasIndex, params[1]);
            }

        } else {
            // set sequenceIndex hash param.
            this.setParam(baseProvider.params.sequenceIndex, this.provider.sequenceIndex);
        }
    }

    // everything from here down is common to wellcomeplayer extensions.

    viewIndex(canvasIndex: number, successCallback?: any): void {
        this.behaviours.viewIndex(canvasIndex, successCallback);
    }

    // ensures that a file is in the server cache.
    prefetchAsset(canvasIndex: number, successCallback: any): void{
        this.behaviours.prefetchAsset(canvasIndex, successCallback);
    }

    authorise(canvasIndex: number, successCallback: any, failureCallback: any): void {
        this.behaviours.authorise(canvasIndex, successCallback, failureCallback);
    }

    login(params: any): void {
        this.behaviours.login(params);
    }

    viewNextAvailableIndex(requestedIndex: number, callback: any): void {
        this.behaviours.viewNextAvailableIndex(requestedIndex, callback);
    }

    // pass direction as 1 or -1.
    nextAvailableIndex(direction: number, requestedIndex: number): number {
        return this.behaviours.nextAvailableIndex(direction, requestedIndex);
    }

    showLoginDialogue(params): void {
        this.behaviours.showLoginDialogue(params);
    }

    isLoggedIn(): boolean {
        return this.behaviours.isLoggedIn();
    }

    isGuest(): boolean {
        return this.behaviours.isGuest();
    }

    hasPermissionToViewCurrentItem(): boolean{
        return this.behaviours.hasPermissionToViewCurrentItem();
    }

    isAuthorised(canvasIndex): boolean {
        return this.behaviours.isAuthorised(canvasIndex);
    }

    showRestrictedFileDialogue(params): void {
        this.behaviours.showRestrictedFileDialogue(params);
    }

    getInadequatePermissionsMessage(canvasIndex): string {
        return this.behaviours.getInadequatePermissionsMessage(canvasIndex);
    }

    allowCloseLogin(): boolean {
        return this.behaviours.allowCloseLogin();
    }

    updateSlidingExpiration(): void {
        this.behaviours.updateSlidingExpiration();
    }

    trackEvent(category: string, action: string, label: string, value: string): void {
        this.behaviours.trackEvent(category, action, label, value);
    }

    trackVariable(slot: number, name: string, value: string, scope: number): void{
        this.behaviours.trackVariable(slot, name, value, scope);
    }

    isSaveToLightboxEnabled(): boolean {
        return this.behaviours.isSaveToLightboxEnabled();
    }

    isDownloadEnabled(): boolean {
        return this.behaviours.isDownloadEnabled();
    }
}
