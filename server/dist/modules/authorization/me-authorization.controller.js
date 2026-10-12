"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.MeAuthorizationController = void 0;
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
const current_user_decorator_1 = require("../auth/current-user.decorator");
const authorization_service_1 = require("./authorization.service");
const authorization_dto_1 = require("./dto/authorization.dto");
let MeAuthorizationController = class MeAuthorizationController {
    constructor(authorizations) {
        this.authorizations = authorizations;
    }
    myAuthorizations(user, query) {
        return this.authorizations.me(user, query);
    }
};
exports.MeAuthorizationController = MeAuthorizationController;
__decorate([
    (0, common_1.Get)('authorizations'),
    (0, swagger_1.ApiOperation)({ summary: '我（附属商家）的授权状态 —— 单次返回全量，S2 发券前直接读' }),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, authorization_dto_1.QueryMeAuthorizationsDto]),
    __metadata("design:returntype", void 0)
], MeAuthorizationController.prototype, "myAuthorizations", null);
exports.MeAuthorizationController = MeAuthorizationController = __decorate([
    (0, swagger_1.ApiTags)('me'),
    (0, swagger_1.ApiBearerAuth)(),
    (0, common_1.Controller)('me'),
    __metadata("design:paramtypes", [authorization_service_1.AuthorizationService])
], MeAuthorizationController);
//# sourceMappingURL=me-authorization.controller.js.map