"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.SubModule = void 0;
const common_1 = require("@nestjs/common");
const core_1 = require("@nestjs/core");
const auth_module_1 = require("../auth/auth.module");
const merchant_scope_guard_1 = require("../../common/guards/merchant-scope.guard");
const sub_controller_1 = require("./sub.controller");
const sub_service_1 = require("./sub.service");
let SubModule = class SubModule {
};
exports.SubModule = SubModule;
exports.SubModule = SubModule = __decorate([
    (0, common_1.Module)({
        imports: [auth_module_1.AuthModule],
        controllers: [sub_controller_1.SubController],
        providers: [
            sub_service_1.SubService,
            { provide: core_1.APP_GUARD, useClass: merchant_scope_guard_1.MerchantScopeGuard },
        ],
    })
], SubModule);
//# sourceMappingURL=sub.module.js.map