import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { NotificationType, NotifyLevel, ReadStatus } from '@prisma/client';
import { Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsEnum,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

/**
 * 发布目标（S5.4-A）
 *  - MERCHANT       指定附属商家（targetIds = 商家 id）
 *  - STORE          指定门店（targetIds = 门店 id）
 *  - ALL_MERCHANTS  本主体直属的全部已审核附属商家
 *  - ALL_STORES     上述附属商家旗下全部营业中门店
 *
 * 已读状态记在每一行上，所以「全部」在发布时展开成一人一行。
 */
export const NOTIFICATION_TARGET_TYPES = ['MERCHANT', 'STORE', 'ALL_MERCHANTS', 'ALL_STORES'] as const;
export type NotificationTargetType = (typeof NOTIFICATION_TARGET_TYPES)[number];

const trim = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value);

export class SendNotificationDto {
  @ApiProperty({ enum: NOTIFICATION_TARGET_TYPES, description: '发布目标类型' })
  @IsIn(NOTIFICATION_TARGET_TYPES as unknown as string[])
  targetType!: NotificationTargetType;

  @ApiPropertyOptional({
    type: [Number],
    description: 'targetType=MERCHANT / STORE 时必填（商家 id / 门店 id，≤200 个）；ALL_* 时不可传',
  })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(200)
  @Type(() => Number)
  @IsInt({ each: true })
  @Min(1, { each: true })
  targetIds?: number[];

  @ApiProperty({ maxLength: 100 })
  @Transform(trim)
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  title!: string;

  @ApiProperty({ maxLength: 1000 })
  @Transform(trim)
  @IsString()
  @IsNotEmpty()
  @MaxLength(1000)
  content!: string;

  @ApiPropertyOptional({ enum: NotificationType, default: NotificationType.SYSTEM })
  @IsOptional()
  @IsEnum(NotificationType)
  type?: NotificationType;

  @ApiPropertyOptional({ enum: NotifyLevel, default: NotifyLevel.NORMAL })
  @IsOptional()
  @IsEnum(NotifyLevel)
  level?: NotifyLevel;
}

export class QueryNotificationDto {
  @ApiPropertyOptional({ default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({ default: 20, maximum: 100 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  pageSize?: number = 20;

  @ApiPropertyOptional({ enum: ReadStatus, description: '传 UNREAD 只看未读' })
  @IsOptional()
  @IsEnum(ReadStatus)
  readStatus?: ReadStatus;

  @ApiPropertyOptional({ enum: NotificationType })
  @IsOptional()
  @IsEnum(NotificationType)
  type?: NotificationType;
}
