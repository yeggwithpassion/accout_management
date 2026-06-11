package account.dao;

import account.dao.core.JdbcExecutor;
import account.dao.core.RowMapper;
import account.dao.model.DomainEnums.AccountType;
import account.dao.model.DomainEnums.FreezeType;
import account.dao.model.DomainModels.FreezeRecord;
import java.sql.Connection;
import java.time.LocalDateTime;
import java.util.List;

public final class FreezeRecordDao extends BaseJdbcDao {

    private static final String SELECT_COLUMNS = """
            select record_id, account_type, account_no, freeze_type, reason, frozen_amount,
                   frozen_quantity, operator_id, created_at, released_at, active
              from freeze_record
            """;

    private static final RowMapper<FreezeRecord> FREEZE_RECORD_MAPPER = resultSet -> new FreezeRecord(
            resultSet.getLong("record_id"),
            AccountType.fromDbValue(resultSet.getString("account_type")),
            resultSet.getString("account_no"),
            FreezeType.fromDbValue(resultSet.getString("freeze_type")),
            resultSet.getString("reason"),
            resultSet.getBigDecimal("frozen_amount"),
            (Integer) resultSet.getObject("frozen_quantity"),
            (Integer) resultSet.getObject("operator_id"),
            getLocalDateTime(resultSet, "created_at"),
            getLocalDateTime(resultSet, "released_at"),
            resultSet.getBoolean("active")
    );

    public FreezeRecordDao(JdbcExecutor executor) {
        super(executor);
    }

    public long create(Connection connection, FreezeRecord record) {
        String sql = """
                insert into freeze_record (
                    account_type, account_no, freeze_type, reason, frozen_amount,
                    frozen_quantity, operator_id, created_at, released_at, active
                ) values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """;
        return executor.insertAndReturnKey(connection, sql, statement -> {
            statement.setString(1, record.accountType().dbValue());
            statement.setString(2, record.accountNo());
            statement.setString(3, record.freezeType().dbValue());
            statement.setString(4, record.reason());
            statement.setBigDecimal(5, record.frozenAmount());
            statement.setObject(6, record.frozenQuantity());
            statement.setObject(7, record.operatorId());
            statement.setTimestamp(8, toSqlTimestamp(defaultTimestamp(record.createdAt())));
            statement.setTimestamp(9, toSqlTimestamp(record.releasedAt()));
            statement.setBoolean(10, record.active());
        });
    }

    public List<FreezeRecord> findActiveRecords(AccountType accountType, String accountNo) {
        return executor.queryList(
                SELECT_COLUMNS + " where account_type = ? and account_no = ? and active = true order by created_at desc",
                statement -> {
                    statement.setString(1, accountType.dbValue());
                    statement.setString(2, accountNo);
                },
                FREEZE_RECORD_MAPPER
        );
    }

    public boolean closeActiveRecord(Connection connection, AccountType accountType, String accountNo, FreezeType freezeType, LocalDateTime releasedAt) {
        String sql = """
                update freeze_record
                   set active = false,
                       released_at = ?
                 where account_type = ?
                   and account_no = ?
                   and freeze_type = ?
                   and active = true
                """;
        return executor.update(connection, sql, statement -> {
            statement.setTimestamp(1, toSqlTimestamp(defaultTimestamp(releasedAt)));
            statement.setString(2, accountType.dbValue());
            statement.setString(3, accountNo);
            statement.setString(4, freezeType.dbValue());
        }) > 0;
    }

    private LocalDateTime defaultTimestamp(LocalDateTime value) {
        return value == null ? LocalDateTime.now() : value;
    }
}
