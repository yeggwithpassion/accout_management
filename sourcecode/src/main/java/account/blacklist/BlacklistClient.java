package account.blacklist;

public interface BlacklistClient {

    boolean isBlocked(String userName);
}