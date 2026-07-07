package com.example.planning;

import com.example.planning.service.SolveOptions;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

class SolveOptionsTest {
    @Test
    void defaultOptionsDoNotSetTimeLimit() {
        SolveOptions options = new SolveOptions();

        assertThat(options.hasTimeLimit()).isFalse();
        assertThat(options.getTimeLimitSeconds()).isNull();
    }

    @Test
    void positiveTimeLimitIsExplicit() {
        SolveOptions options = new SolveOptions(30L);

        assertThat(options.hasTimeLimit()).isTrue();
        assertThat(options.getTimeLimitSeconds()).isEqualTo(30L);
    }

    @Test
    void nonPositiveTimeLimitDisablesAutomaticLimit() {
        SolveOptions options = new SolveOptions(0L);

        assertThat(options.hasTimeLimit()).isFalse();
        assertThat(options.getTimeLimitSeconds()).isNull();
    }
}
