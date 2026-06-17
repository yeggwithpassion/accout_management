package com.zju.account.common;

import lombok.Getter;

/**
 * 业务错误码枚举，严格对齐《账户业务系统接口文档》"完整错误码表"。
 *
 * code 字段为对外暴露给前端 / 上游系统的数字结果码；
 * symbol 为文档中使用的 ERR_xxx 字符串编码。
 */
@Getter
public enum ErrorCode {

    SUCCESS(0, "OK", "成功"),

    ERR_001(1001, "ERR_001", "余额不足"),
    ERR_002(1002, "ERR_002", "持仓不足"),
    ERR_003(1003, "ERR_003", "账户已冻结"),
    ERR_004(1004, "ERR_004", "密码错误"),
    ERR_005(1005, "ERR_005", "证券账户不存在"),
    ERR_006(1006, "ERR_006", "该投资者已拥有其他证券账户"),
    ERR_007(1007, "ERR_007", "资金账户尚有可用余额或冻结资金，无法解绑"),
    ERR_008(1008, "ERR_008", "证券账户未关联当前资金账户"),
    ERR_009(1009, "ERR_009", "管理员权限不足"),
    ERR_010(1010, "ERR_010", "账户不存在"),
    ERR_011(1011, "ERR_011", "账户已是请求的状态"),
    ERR_012(1012, "ERR_012", "投资者在黑名单中"),
    ERR_013(1013, "ERR_013", "证券账户持有人与投资者身份证不一致"),
    ERR_014(1014, "ERR_014", "该资金账户已绑定其他证券账户"),
    ERR_015(1015, "ERR_015", "该资金账户未绑定任何证券账户"),
    ERR_016(1016, "ERR_016", "资金账户存在未成交委托单"),
    ERR_017(1017, "ERR_017", "资金账户处于冻结状态，无法销户"),

    PARAM_INVALID(4000, "ERR_PARAM", "参数校验失败"),
    SYSTEM_ERROR(5000, "ERR_SYS", "系统内部错误");

    private final int code;
    private final String symbol;
    private final String message;

    ErrorCode(int code, String symbol, String message) {
        this.code = code;
        this.symbol = symbol;
        this.message = message;
    }
}
