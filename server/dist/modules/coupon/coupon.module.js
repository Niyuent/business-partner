"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.CouponModule = void 0;
const common_1 = require("@nestjs/common");
const audit_log_module_1 = require("../audit-log/audit-log.module");
const authorization_module_1 = require("../authorization/authorization.module");
const coupon_code_controller_1 = require("./coupon-code.controller");
const coupon_code_service_1 = require("./coupon-code.service");
const coupon_instance_controller_1 = require("./coupon-instance.controller");
const coupon_instance_service_1 = require("./coupon-instance.service");
const coupon_template_controller_1 = require("./coupon-template.controller");
const coupon_template_service_1 = require("./coupon-template.service");
const redemption_controller_1 = require("./redemption.controller");
const redemption_service_1 = require("./redemption.service");
let CouponModule = class CouponModule {
};
exports.CouponModule = CouponModule;
exports.CouponModule = CouponModule = __decorate([
    (0, common_1.Module)({
        imports: [audit_log_module_1.AuditLogModule, authorization_module_1.AuthorizationModule],
        controllers: [
            coupon_template_controller_1.CouponTemplateController,
            coupon_code_controller_1.CouponCodeController,
            coupon_instance_controller_1.CouponInstanceController,
            redemption_controller_1.RedemptionController,
        ],
        providers: [
            coupon_template_service_1.CouponTemplateService,
            coupon_code_service_1.CouponCodeService,
            coupon_instance_service_1.CouponInstanceService,
            redemption_service_1.RedemptionService,
        ],
        exports: [coupon_template_service_1.CouponTemplateService, coupon_code_service_1.CouponCodeService, coupon_instance_service_1.CouponInstanceService, redemption_service_1.RedemptionService],
    })
], CouponModule);
//# sourceMappingURL=coupon.module.js.map