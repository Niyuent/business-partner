"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CHARSET = exports.CODE_LENGTH = void 0;
exports.checkChar = checkChar;
exports.generateCouponCode = generateCouponCode;
exports.generateCouponCodes = generateCouponCodes;
exports.isValidCouponCode = isValidCouponCode;
const crypto_1 = require("crypto");
exports.CODE_LENGTH = 12;
exports.CHARSET = '23456789ABCDEFGHJKMNPQRSTUVWXYZ';
const SAMPLE_LIMIT = 65536 - (65536 % exports.CHARSET.length);
function randomIndex() {
    for (;;) {
        const buf = (0, crypto_1.randomBytes)(2);
        const value = (buf[0] << 8) | buf[1];
        if (value < SAMPLE_LIMIT)
            return value % exports.CHARSET.length;
    }
}
function checkChar(payload) {
    let sum = 0;
    for (let i = 0; i < payload.length; i++) {
        const idx = exports.CHARSET.indexOf(payload[i]);
        if (idx < 0)
            throw new Error(`非法字符 ${payload[i]}：不在券码字符集内`);
        sum += (idx + 1) * (i + 1);
    }
    return exports.CHARSET[sum % exports.CHARSET.length];
}
function generateCouponCode() {
    let payload = '';
    for (let i = 0; i < exports.CODE_LENGTH - 1; i++) {
        payload += exports.CHARSET[randomIndex()];
    }
    return payload + checkChar(payload);
}
function generateCouponCodes(count) {
    const set = new Set();
    let guard = 0;
    while (set.size < count) {
        set.add(generateCouponCode());
        if (++guard > count * 100)
            break;
    }
    return [...set];
}
function isValidCouponCode(code) {
    if (!code || code.length !== exports.CODE_LENGTH)
        return false;
    const payload = code.slice(0, exports.CODE_LENGTH - 1);
    const check = code.slice(exports.CODE_LENGTH - 1);
    for (const ch of payload) {
        if (!exports.CHARSET.includes(ch))
            return false;
    }
    return checkChar(payload) === check;
}
//# sourceMappingURL=coupon-code.util.js.map