package com.zju.account.enums;

/**
 * 账户状态枚举（对接 newStatus / status 字段）。
 * 文档中两套表达：
 *  - 对接外部子系统 / 数据库设计文档：使用中文（正常 / 挂失冻结 / 违规冻结 / 预销户 / 已销户）
 *  - 账户业务系统接口文档：使用英文（NORMAL / FROZEN_LOSS / FROZEN_VIOLATION / PRE_CLOSE / CLOSED）
 * 内部统一以英文枚举管理，对外返回时由 Controller 按文档要求映射。
 */
public enum AccountStatus {
    NORMAL("正常"),
    FROZEN_LOSS("挂失冻结"),
    FROZEN_VIOLATION("违规冻结"),
    PRE_CLOSE("预销户"),
    CLOSED("已销户");

    private final String cn;

    AccountStatus(String cn) {
        this.cn = cn;
    }

    public String cn() {
        return cn;
    }
}
