package com.craftcore;

import org.junit.platform.launcher.Launcher;
import org.junit.platform.launcher.LauncherDiscoveryRequest;
import org.junit.platform.launcher.core.LauncherDiscoveryRequestBuilder;
import org.junit.platform.launcher.core.LauncherFactory;
import org.junit.platform.launcher.listeners.SummaryGeneratingListener;
import org.junit.platform.launcher.listeners.TestExecutionSummary;
import static org.junit.platform.engine.discovery.DiscoverySelectors.selectClass;

public class TestRunner {
    public static void main(String[] args) {
        System.out.println("Starting custom JUnit test runner...");
        try {
            LauncherDiscoveryRequest request = LauncherDiscoveryRequestBuilder.request()
                .selectors(
                    selectClass("com.craftcore.CommandCapturerTest"),
                    selectClass("com.craftcore.SearchAndLogTest"),
                    selectClass("com.craftcore.SerializationTest"),
                    selectClass("com.craftcore.ShopSearchAndLogsTest"),
                    selectClass("com.craftcore.e2e.AdversarialChallengerTest"),
                    selectClass("com.craftcore.e2e.AdversarialMilestone3Test"),
                    selectClass("com.craftcore.e2e.AdversarialMilestone4Test"),
                    selectClass("com.craftcore.e2e.Tier1FeatureCoverageTest"),
                    selectClass("com.craftcore.e2e.Tier2BoundaryCornerTest"),
                    selectClass("com.craftcore.e2e.Tier3CrossFeatureTest"),
                    selectClass("com.craftcore.e2e.Tier4RealWorldTest"),
                    selectClass("com.craftcore.e2e.VulnerabilityFixTest")
                )
                .build();
            Launcher launcher = LauncherFactory.create();
            SummaryGeneratingListener listener = new SummaryGeneratingListener();
            launcher.registerTestExecutionListeners(listener);
            launcher.execute(request);
            TestExecutionSummary summary = listener.getSummary();
            
            System.out.println("==================================================");
            System.out.println("JUnit Test Run Summary:");
            System.out.println("  Tests started: " + summary.getTestsStartedCount());
            System.out.println("  Tests succeeded: " + summary.getTestsSucceededCount());
            System.out.println("  Tests failed: " + summary.getTestsFailedCount());
            System.out.println("==================================================");
            
            if (summary.getTestsFailedCount() > 0) {
                summary.getFailures().forEach(f -> {
                    System.err.println("FAIL: " + f.getTestIdentifier().getDisplayName());
                    if (f.getException() != null) {
                        f.getException().printStackTrace();
                    }
                });
                System.exit(1);
            }
            if (summary.getTestsStartedCount() == 0) {
                System.err.println("FAIL: No tests were executed!");
                System.exit(2);
            }
            System.out.println("All tests passed successfully!");
            System.exit(0);
        } catch (Throwable t) {
            t.printStackTrace();
            System.exit(3);
        }
    }
}
