package com.zju.account.service.util;

import account.dao.model.DomainEnums;

/**
 * Controller 层枚举与 DAO 层枚举之间的映射工具。
 */
public final class EnumMapper {

    private EnumMapper() {
    }

    // ==================== AccountStatus mapping ====================

    public static DomainEnums.AccountStatus toDaoStatus(com.zju.account.enums.AccountStatus status) {
        if (status == null) {
            return null;
        }
        return switch (status) {
            case NORMAL -> DomainEnums.AccountStatus.NORMAL;
            case FROZEN_LOSS -> DomainEnums.AccountStatus.LOSS_FROZEN;
            case FROZEN_VIOLATION -> DomainEnums.AccountStatus.VIOLATION_FROZEN;
            case PRE_CLOSE -> DomainEnums.AccountStatus.PRE_CLOSE;
            case CLOSED -> DomainEnums.AccountStatus.CLOSED;
        };
    }

    public static com.zju.account.enums.AccountStatus fromDaoStatus(DomainEnums.AccountStatus status) {
        if (status == null) {
            return null;
        }
        return switch (status) {
            case NORMAL -> com.zju.account.enums.AccountStatus.NORMAL;
            case LOSS_FROZEN -> com.zju.account.enums.AccountStatus.FROZEN_LOSS;
            case VIOLATION_FROZEN -> com.zju.account.enums.AccountStatus.FROZEN_VIOLATION;
            case PRE_CLOSE -> com.zju.account.enums.AccountStatus.PRE_CLOSE;
            case CLOSED -> com.zju.account.enums.AccountStatus.CLOSED;
        };
    }

    // ==================== FreezeType mapping ====================

    public static DomainEnums.FreezeType toDaoFreezeType(com.zju.account.enums.FreezeType freezeType) {
        if (freezeType == null) {
            return null;
        }
        return switch (freezeType) {
            case LOSS -> DomainEnums.FreezeType.LOSS;
            case VIOLATION -> DomainEnums.FreezeType.VIOLATION;
        };
    }

    public static com.zju.account.enums.FreezeType fromDaoFreezeType(DomainEnums.FreezeType freezeType) {
        if (freezeType == null) {
            return null;
        }
        return switch (freezeType) {
            case LOSS -> com.zju.account.enums.FreezeType.LOSS;
            case VIOLATION -> com.zju.account.enums.FreezeType.VIOLATION;
            default -> null;
        };
    }

    // ==================== AccountType mapping ====================

    public static DomainEnums.AccountType toDaoAccountType(com.zju.account.enums.AccountType accountType) {
        if (accountType == null) {
            return null;
        }
        return switch (accountType) {
            case SECURITY -> DomainEnums.AccountType.SECURITY;
            case FUND -> DomainEnums.AccountType.FUND;
        };
    }

    // ==================== InvestorType mapping ====================

    public static DomainEnums.InvestorType toDaoInvestorType(String investorTypeCn) {
        if (investorTypeCn == null) {
            return null;
        }
        return switch (investorTypeCn) {
            case "个人" -> DomainEnums.InvestorType.PERSONAL;
            case "法人" -> DomainEnums.InvestorType.LEGAL_ENTITY;
            default -> throw new IllegalArgumentException("不支持的投资者类型: " + investorTypeCn);
        };
    }

    public static String fromDaoInvestorType(DomainEnums.InvestorType investorType) {
        if (investorType == null) {
            return null;
        }
        return switch (investorType) {
            case PERSONAL -> "个人";
            case LEGAL_ENTITY -> "法人";
        };
    }
}
