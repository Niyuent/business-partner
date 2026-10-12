"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Permissions = exports.Roles = exports.PERMISSIONS_KEY = exports.ROLES_KEY = void 0;
const common_1 = require("@nestjs/common");
exports.ROLES_KEY = 'shangmeng:roles';
exports.PERMISSIONS_KEY = 'shangmeng:permissions';
const Roles = (...codes) => (0, common_1.SetMetadata)(exports.ROLES_KEY, codes);
exports.Roles = Roles;
const Permissions = (...codes) => (0, common_1.SetMetadata)(exports.PERMISSIONS_KEY, codes);
exports.Permissions = Permissions;
//# sourceMappingURL=roles.decorator.js.map