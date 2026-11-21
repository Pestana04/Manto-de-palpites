package br.com.mantodepalpites;

import java.util.Set;

public final class Scoring {
    private Scoring() {}
    public static boolean finished(String status) { return Set.of("FT", "AET", "PEN").contains(status); }
    // Final score includes extra time, excludes the penalty shootout.
    public static int points(int home, int away, Integer actualHome, Integer actualAway, String status) {
        if (!finished(status) || actualHome == null || actualAway == null) return 0;
        if (home == actualHome && away == actualAway) return 5;
        return Integer.signum(home - away) == Integer.signum(actualHome - actualAway) ? 3 : 0;
    }
}
