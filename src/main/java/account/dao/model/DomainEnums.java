package account.dao.model;

import java.util.Arrays;

public final class DomainEnums {

    private DomainEnums() {
    }

    public interface DbValueEnum {
        String dbValue();
    }

    public enum InvestorType implements DbValueEnum {
        PERSONAL("\u4e2a\u4eba"),
        LEGAL_ENTITY("\u6cd5\u4eba");

        private final String dbValue;

        InvestorType(String dbValue) {
            this.dbValue = dbValue;
        }

        @Override
        public String dbValue() {
            return dbValue;
        }

        public static InvestorType fromDbValue(String dbValue) {
            return DomainEnums.fromDbValue(InvestorType.class, dbValue);
        }
    }

    public enum AccountStatus implements DbValueEnum {
        NORMAL("\u6b63\u5e38"),
        LOSS_FROZEN("\u6302\u5931\u51bb\u7ed3"),
        VIOLATION_FROZEN("\u8fdd\u89c4\u51bb\u7ed3"),
        PRE_CLOSE("\u9884\u9500\u6237"),
        CLOSED("\u5df2\u9500\u6237");

        private final String dbValue;

        AccountStatus(String dbValue) {
            this.dbValue = dbValue;
        }

        @Override
        public String dbValue() {
            return dbValue;
        }

        public static AccountStatus fromDbValue(String dbValue) {
            return DomainEnums.fromDbValue(AccountStatus.class, dbValue);
        }
    }

    public enum FundTransactionType implements DbValueEnum {
        DEPOSIT("\u5b58\u6b3e"),
        WITHDRAW("\u53d6\u6b3e"),
        BUY_FREEZE("\u4e70\u5165\u51bb\u7ed3"),
        BUY_DEBIT("\u4e70\u5165\u6263\u6b3e"),
        SELL_RETURN("\u5356\u51fa\u56de\u6b3e"),
        CANCEL_RELEASE("\u64a4\u5355\u89e3\u51bb"),
        INTEREST("\u7ed3\u606f");

        private final String dbValue;

        FundTransactionType(String dbValue) {
            this.dbValue = dbValue;
        }

        @Override
        public String dbValue() {
            return dbValue;
        }

        public static FundTransactionType fromDbValue(String dbValue) {
            return DomainEnums.fromDbValue(FundTransactionType.class, dbValue);
        }
    }

    public enum AccountType implements DbValueEnum {
        SECURITY("SECURITY"),
        FUND("FUND");

        private final String dbValue;

        AccountType(String dbValue) {
            this.dbValue = dbValue;
        }

        @Override
        public String dbValue() {
            return dbValue;
        }

        public static AccountType fromDbValue(String dbValue) {
            return DomainEnums.fromDbValue(AccountType.class, dbValue);
        }
    }

    public enum FreezeType implements DbValueEnum {
        LOSS("LOSS"),
        VIOLATION("VIOLATION"),
        BUY_ORDER("BUY_ORDER"),
        SELL_ORDER("SELL_ORDER");

        private final String dbValue;

        FreezeType(String dbValue) {
            this.dbValue = dbValue;
        }

        @Override
        public String dbValue() {
            return dbValue;
        }

        public static FreezeType fromDbValue(String dbValue) {
            return DomainEnums.fromDbValue(FreezeType.class, dbValue);
        }
    }

    private static <E extends Enum<E> & DbValueEnum> E fromDbValue(Class<E> type, String dbValue) {
        if (dbValue == null) {
            return null;
        }
        return Arrays.stream(type.getEnumConstants())
                .filter(value -> value.dbValue().equals(dbValue))
                .findFirst()
                .orElseThrow(() -> new IllegalArgumentException("Unsupported db value '" + dbValue + "' for " + type.getSimpleName()));
    }
}
