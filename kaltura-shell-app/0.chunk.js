webpackJsonp([0],{

/***/ "../../../../../src/applications/analytics-live-app/analytics-live-app.module.ts":
/***/ (function(module, __webpack_exports__, __webpack_require__) {

"use strict";
Object.defineProperty(__webpack_exports__, "__esModule", { value: true });
/* harmony import */ var __WEBPACK_IMPORTED_MODULE_0_tslib__ = __webpack_require__("../../../../tslib/tslib.es6.js");
/* harmony import */ var __WEBPACK_IMPORTED_MODULE_1__angular_core__ = __webpack_require__("../../../core/@angular/core.es5.js");
/* harmony import */ var __WEBPACK_IMPORTED_MODULE_2__angular_common__ = __webpack_require__("../../../common/@angular/common.es5.js");
/* harmony import */ var __WEBPACK_IMPORTED_MODULE_3__angular_router__ = __webpack_require__("../../../router/@angular/router.es5.js");
/* harmony import */ var __WEBPACK_IMPORTED_MODULE_4__analytics_live_app_routes__ = __webpack_require__("../../../../../src/applications/analytics-live-app/analytics-live-app.routes.ts");
/* harmony import */ var __WEBPACK_IMPORTED_MODULE_5__analytics_live_component__ = __webpack_require__("../../../../../src/applications/analytics-live-app/analytics-live.component.ts");
/* harmony import */ var __WEBPACK_IMPORTED_MODULE_6__kaltura_ng_kaltura_ui__ = __webpack_require__("../../../../../../kaltura-ng/kaltura-ui/dist/index.js");
/* harmony export (binding) */ __webpack_require__.d(__webpack_exports__, "AnalyticsLiveAppModule", function() { return AnalyticsLiveAppModule; });







var AnalyticsLiveAppModule = (function () {
    function AnalyticsLiveAppModule() {
    }
    return AnalyticsLiveAppModule;
}());
AnalyticsLiveAppModule = __WEBPACK_IMPORTED_MODULE_0_tslib__["a" /* __decorate */]([
    __webpack_require__.i(__WEBPACK_IMPORTED_MODULE_1__angular_core__["NgModule"])({
        imports: [
            __WEBPACK_IMPORTED_MODULE_2__angular_common__["CommonModule"],
            __WEBPACK_IMPORTED_MODULE_3__angular_router__["RouterModule"].forChild(__WEBPACK_IMPORTED_MODULE_4__analytics_live_app_routes__["a" /* routing */]),
            __WEBPACK_IMPORTED_MODULE_6__kaltura_ng_kaltura_ui__["d" /* KalturaUIModule */]
        ],
        declarations: [
            __WEBPACK_IMPORTED_MODULE_5__analytics_live_component__["a" /* AnalyticsLiveComponent */]
        ],
        exports: [],
        providers: [],
    })
], AnalyticsLiveAppModule);

//# sourceMappingURL=analytics-live-app.module.js.map

/***/ }),

/***/ "../../../../../src/applications/analytics-live-app/analytics-live-app.routes.ts":
/***/ (function(module, __webpack_exports__, __webpack_require__) {

"use strict";
/* harmony import */ var __WEBPACK_IMPORTED_MODULE_0__analytics_live_component__ = __webpack_require__("../../../../../src/applications/analytics-live-app/analytics-live.component.ts");
/* harmony export (binding) */ __webpack_require__.d(__webpack_exports__, "a", function() { return routing; });

var routing = [
    { path: '', redirectTo: 'live', pathMatch: 'full' },
    { path: 'live', component: __WEBPACK_IMPORTED_MODULE_0__analytics_live_component__["a" /* AnalyticsLiveComponent */] }
];
//# sourceMappingURL=analytics-live-app.routes.js.map

/***/ }),

/***/ "../../../../../src/applications/analytics-live-app/analytics-live.component.html":
/***/ (function(module, exports) {

module.exports = "<div class=\"kApp\">\n    <iframe frameborder=\"0px\" [src]=\"appUrl | safe\"></iframe>\n</div>"

/***/ }),

/***/ "../../../../../src/applications/analytics-live-app/analytics-live.component.scss":
/***/ (function(module, exports, __webpack_require__) {

exports = module.exports = __webpack_require__("../../../../css-loader/lib/css-base.js")(false);
// imports


// module
exports.push([module.i, "/* Application */\n/* App menu colors */\n/* Gridlex overrides */\n/* colors */\n.kApp {\n  height: calc(100vh - 105px); }\n  .kApp iframe {\n    width: 100%;\n    height: calc(100vh - 50px); }\n", ""]);

// exports


/*** EXPORTS FROM exports-loader ***/
module.exports = module.exports.toString();

/***/ }),

/***/ "../../../../../src/applications/analytics-live-app/analytics-live.component.ts":
/***/ (function(module, __webpack_exports__, __webpack_require__) {

"use strict";
/* harmony import */ var __WEBPACK_IMPORTED_MODULE_0_tslib__ = __webpack_require__("../../../../tslib/tslib.es6.js");
/* harmony import */ var __WEBPACK_IMPORTED_MODULE_1__angular_core__ = __webpack_require__("../../../core/@angular/core.es5.js");
/* harmony import */ var __WEBPACK_IMPORTED_MODULE_2_app_shared_kmc_shell__ = __webpack_require__("../../../../../src/shared/kmc-shell/index.ts");
/* harmony import */ var __WEBPACK_IMPORTED_MODULE_3_app_config__ = __webpack_require__("../../../../../src/app-config/index.ts");
/* harmony export (binding) */ __webpack_require__.d(__webpack_exports__, "a", function() { return AnalyticsLiveComponent; });




var AnalyticsLiveComponent = (function () {
    function AnalyticsLiveComponent(appAuthentication) {
        this.appAuthentication = appAuthentication;
    }
    AnalyticsLiveComponent.prototype.ngOnInit = function () {
        this.appUrl = __WEBPACK_IMPORTED_MODULE_3_app_config__["a" /* environment */].modules.analyticsLive.url + "?ks=" + this.appAuthentication.appUser.ks;
    };
    AnalyticsLiveComponent.prototype.ngAfterViewInit = function () {
    };
    AnalyticsLiveComponent.prototype.ngOnDestroy = function () {
    };
    return AnalyticsLiveComponent;
}());
AnalyticsLiveComponent = __WEBPACK_IMPORTED_MODULE_0_tslib__["a" /* __decorate */]([
    __webpack_require__.i(__WEBPACK_IMPORTED_MODULE_1__angular_core__["Component"])({
        selector: 'kAnalyticsLive',
        template: __webpack_require__("../../../../../src/applications/analytics-live-app/analytics-live.component.html"),
        styles: [__webpack_require__("../../../../../src/applications/analytics-live-app/analytics-live.component.scss")],
        providers: []
    }),
    __WEBPACK_IMPORTED_MODULE_0_tslib__["b" /* __metadata */]("design:paramtypes", [typeof (_a = typeof __WEBPACK_IMPORTED_MODULE_2_app_shared_kmc_shell__["g" /* AppAuthentication */] !== "undefined" && __WEBPACK_IMPORTED_MODULE_2_app_shared_kmc_shell__["g" /* AppAuthentication */]) === "function" && _a || Object])
], AnalyticsLiveComponent);

var _a;
//# sourceMappingURL=analytics-live.component.js.map

/***/ })

});
//# sourceMappingURL=0.chunk.js.map