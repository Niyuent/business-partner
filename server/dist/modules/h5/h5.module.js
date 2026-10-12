"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.H5Module = void 0;
const common_1 = require("@nestjs/common");
const auth_module_1 = require("../auth/auth.module");
const point_module_1 = require("../point/point.module");
const h5_controller_1 = require("./h5.controller");
const h5_service_1 = require("./h5.service");
let H5Module = class H5Module {
};
exports.H5Module = H5Module;
exports.H5Module = H5Module = __decorate([
    (0, common_1.Module)({
        imports: [auth_module_1.AuthModule, point_module_1.PointModule],
        controllers: [h5_controller_1.H5Controller],
        providers: [h5_service_1.H5Service],
    })
], H5Module);
//# sourceMappingURL=h5.module.js.map