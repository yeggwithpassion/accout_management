package account.dao;

import java.sql.Connection;
import java.time.LocalDateTime;
import java.util.List;

import account.dao.core.JdbcExecutor;
import account.dao.core.RowMapper;
import account.dao.model.DomainModels.BlacklistEntry;


public final class BlacklistDao extends BaseJdbcDao {

    private static final String SELECT_COLUMNS = """
            select blacklist_id, certificate_no, reason, created_by, active, created_at, updated_at
              from blacklist
            """;

    private static final RowMapper<BlacklistEntry> BLACKLIST_MAPPER = resultSet -> new BlacklistEntry(
            resultSet.getLong("blacklist_id"),
            resultSet.getString("certificate_no"),
            resultSet.getString("reason"),
            (Integer) resultSet.getObject("created_by"),
            resultSet.getBoolean("active"),
            getLocalDateTime(resultSet, "created_at"),
            getLocalDateTime(resultSet, "updated_at")
    );

    public BlacklistDao(JdbcExecutor executor) {
        super(executor);
    }

    public boolean isBlocked(String certificateNo) {
        return executor.queryOne(
                "select 1 from blacklist where certificate_no = ? and active = true limit 1",
                statement -> statement.setString(1, certificateNo),
                resultSet -> resultSet.getInt(1)
        ).isPresent();
    }

    public List<BlacklistEntry> listActiveEntries() {
        return executor.queryList(
                SELECT_COLUMNS + " where active = true order by updated_at desc, blacklist_id desc",
                null,
                BLACKLIST_MAPPER
        );
    }

    public long create(Connection connection, BlacklistEntry entry) {
        String sql = """
                insert into blacklist (
                    certificate_no, reason, created_by, active, created_at, updated_at
                ) values (?, ?, ?, ?, ?, ?)
                """;
        return executor.insertAndReturnKey(connection, sql, statement -> {
            statement.setString(1, entry.certificateNo());
            statement.setString(2, entry.reason());
            statement.setObject(3, entry.createdBy());
            statement.setBoolean(4, entry.active());
            statement.setTimestamp(5, toSqlTimestamp(defaultTimestamp(entry.createdAt())));
            statement.setTimestamp(6, toSqlTimestamp(defaultTimestamp(entry.updatedAt())));
        });
    }

    public boolean deactivate(Connection connection, String certificateNo) {
        String sql = """
                update blacklist
                   set active = false,
                       updated_at = ?
                 where certificate_no = ?
                   and active = true
                """;
        return executor.update(connection, sql, statement -> {
            statement.setTimestamp(1, toSqlTimestamp(LocalDateTime.now()));
            statement.setString(2, certificateNo);
        }) > 0;
    }

    private LocalDateTime defaultTimestamp(LocalDateTime value) {
        return value == null ? LocalDateTime.now() : value;
    }
}
