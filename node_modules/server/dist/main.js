"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const common_1 = require("@nestjs/common");
const core_1 = require("@nestjs/core");
const swagger_1 = require("@nestjs/swagger");
const fs_1 = require("fs");
const path_1 = require("path");
const app_module_1 = require("./app.module");
const all_exceptions_filter_1 = require("./common/filters/all-exceptions.filter");
const response_interceptor_1 = require("./common/interceptors/response.interceptor");
async function bootstrap() {
    const logger = new common_1.Logger('Bootstrap');
    const app = await core_1.NestFactory.create(app_module_1.AppModule);
    const prefix = process.env.API_PREFIX ?? 'api/v1';
    app.setGlobalPrefix(prefix);
    app.set('trust proxy', 1);
    const uploadDir = process.env.UPLOAD_DIR ?? (0, path_1.join)(process.cwd(), 'uploads');
    if (!(0, fs_1.existsSync)(uploadDir))
        (0, fs_1.mkdirSync)(uploadDir, { recursive: true });
    app.useStaticAssets(uploadDir, { prefix: '/uploads/' });
    app.useGlobalPipes(new common_1.ValidationPipe({
        whitelist: true,
        transform: true,
        forbidNonWhitelisted: false,
    }));
    app.useGlobalInterceptors(new response_interceptor_1.ResponseInterceptor());
    app.useGlobalFilters(new all_exceptions_filter_1.AllExceptionsFilter());
    app.enableCors();
    if (process.env.NODE_ENV !== 'production') {
        const swagger = new swagger_1.DocumentBuilder()
            .setTitle('商盟系统 API')
            .setDescription('代金券积分系统 · 网页端管理后台接口文档')
            .setVersion('0.1.0')
            .addBearerAuth()
            .build();
        swagger_1.SwaggerModule.setup('api/docs', app, swagger_1.SwaggerModule.createDocument(app, swagger));
    }
    const port = Number(process.env.PORT ?? 3000);
    await app.listen(port);
    logger.log(`服务已启动: http://localhost:${port}/${prefix}`);
    if (process.env.NODE_ENV !== 'production') {
        logger.log(`接口文档: http://localhost:${port}/api/docs`);
    }
    else {
        logger.log('接口文档: 已按 NODE_ENV=production 关闭');
    }
}
bootstrap();
//# sourceMappingURL=main.js.map