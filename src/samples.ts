import { SampleCode } from "./types";

export const SAMPLE_CODES: SampleCode[] = [
  {
    id: "sql-injection-secrets",
    name: "Spring Boot: SQL Injection & Secrets",
    description: "A Controller containing direct SQL queries, string concatenation with raw parameters, and hardcoded secrets.",
    fileName: "src/main/java/com/devguard/auth/UserAuthController.java",
    isDiff: false,
    content: `package com.devguard.auth;

import org.springframework.web.bind.annotation.*;
import java.sql.*;
import java.util.*;

@RestController
@RequestMapping("/api/auth")
public class UserAuthController {

    // CRITICAL: Hardcoded AWS Creds and JWT Secret Key
    private static final String AWS_ACCESS_KEY = "AKIAIOSFODNN7EXAMPLE";
    private static final String JWT_SECRET = "super_secret_jwt_key_1234567890_devguard_ai_reviewer_prod_key_change_me";

    @GetMapping("/search")
    public List<Map<String, Object>> searchUsers(@RequestParam String username) {
        List<Map<String, Object>> results = new ArrayList<>();
        
        // CRITICAL: SQL Injection vulnerability via raw string concatenation
        String query = "SELECT id, username, email, role FROM users WHERE active = 1 AND username = '" + username + "'";
        
        try {
            Connection conn = DriverManager.getConnection("jdbc:mysql://localhost:3306/prod_db", "admin", "P@ssw0rd123!");
            Statement stmt = conn.createStatement();
            ResultSet rs = stmt.executeQuery(query);
            
            while (rs.next()) {
                Map<String, Object> user = new HashMap<>();
                user.add("id", rs.getInt("id"));
                user.add("username", rs.getString("username"));
                user.add("email", rs.getString("email"));
                user.add("role", rs.getString("role"));
                results.add(user);
            }
        } catch (SQLException e) {
            // NullPointerException Risk: returning null or empty without proper logging
            e.printStackTrace();
        }
        
        return results;
    }
}`
  },
  {
    id: "resource-leak",
    name: "Java IO: FileInputStream Resource Leak",
    description: "Unclosed FileInputStreams, standard exceptions caught and discarded, and potential memory leaks during parse loops.",
    fileName: "src/main/java/com/devguard/parser/FileConfigLoader.java",
    isDiff: false,
    content: `package com.devguard.parser;

import java.io.*;
import java.util.Properties;

public class FileConfigLoader {

    public Properties loadProperties(String filePath) {
        Properties props = new Properties();
        try {
            // CRITICAL:FileInputStream is opened but never closed, causing an OS resource leak
            File file = new File(filePath);
            FileInputStream fis = new FileInputStream(file);
            
            props.load(fis);
            
            // If an exception occurs during props.load(), fis remains open!
            fis.close(); 
        } catch (Exception e) {
            // BAD PRACTICE: Empty exception handler burying root causes
            System.out.println("Failed to load configs from " + filePath);
        }
        return props;
    }

    public void processLargeLog(String logPath) {
        BufferedReader reader = null;
        try {
            // CRITICAL: Reader initialized but in high throughput loops, if exception occurs, handles poorly
            reader = new BufferedReader(new FileReader(logPath));
            String line;
            while ((line = reader.readLine()) != null) {
                if (line.contains("ERROR")) {
                    processErrorLine(line);
                }
            }
        } catch (IOException e) {
            // No logger used, prints directly to stdout
            System.out.println(e.getMessage());
        }
        // Missing finally block to safely close the reader!
    }

    private void processErrorLine(String line) {
        // Mock processing
    }
}`
  },
  {
    id: "jpa-n-plus-one",
    name: "JPA & Hibernate: N+1 Lazy Query",
    description: "Triggers lazy loaded fetches inside iteration loops, and suboptimal list-searching leading to performance bottlenecks.",
    fileName: "src/main/java/com/devguard/service/ReportGeneratorService.java",
    isDiff: false,
    content: `package com.devguard.service;

import com.devguard.model.*;
import com.devguard.repository.*;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.util.*;

@Service
public class ReportGeneratorService {

    private final UserRepository userRepository;
    private final OrderRepository orderRepository;

    public ReportGeneratorService(UserRepository userRepository, OrderRepository orderRepository) {
        this.userRepository = userRepository;
        this.orderRepository = orderRepository;
    }

    @Transactional(readOnly = true)
    public List<UserActivityReport> generateUserReports() {
        // Triggers loading of all users
        List<User> users = userRepository.findAll(); 
        List<UserActivityReport> reports = new ArrayList<>();

        for (User user : users) {
            // CRITICAL: Triggers an N+1 Hibernate SELECT query for each loop iteration
            // user.getOrders() is Lazy-loaded, making a DB query for EVERY single user
            List<Order> orders = user.getOrders();
            double totalSpent = 0;
            
            for (Order o : orders) {
                totalSpent += o.getAmount();
            }

            // PERFORMANCE BUG: Unnecessarily checking items in an ArrayList of 10,000 orders
            // using List.contains() in a loop, resulting in an O(N^2) complexity bottleneck
            List<Order> archivedOrders = orderRepository.findArchivedByUserId(user.getId());
            int archCount = 0;
            for (Order o : orders) {
                if (archivedOrders.contains(o)) {
                    archCount++;
                }
            }

            reports.add(new UserActivityReport(user.getUsername(), orders.size(), totalSpent, archCount));
        }

        return reports;
    }
}`
  },
  {
    id: "git-diff-pr",
    name: "Git Diff: Thread Safety & NPE Vulnerability",
    description: "A complete unified Git Diff showing modifications in a thread-unsafe Controller and direct Object access.",
    fileName: "src/main/java/com/devguard/payment/PaymentProcessor.java",
    isDiff: true,
    content: `diff --git a/src/main/java/com/devguard/payment/PaymentProcessor.java b/src/main/java/com/devguard/payment/PaymentProcessor.java
index b18fca2..9f48ac1 100644
--- a/src/main/java/com/devguard/payment/PaymentProcessor.java
+++ b/src/main/java/com/devguard/payment/PaymentProcessor.java
@@ -12,24 +12,38 @@ import java.util.*;
 public class PaymentProcessor {
 
-    private final Object lock = new Object();
-    private double totalProcessedVolume = 0.0;
+    // CRITICAL BUG: Static shared mutable map without synchronization
+    private static Map<String, Double> merchantBalances = new HashMap<>();
+    private static double totalProcessedVolume = 0.0;
 
     public void processMerchantPayment(String merchantId, Double amount) {
-        synchronized(lock) {
-            totalProcessedVolume += amount;
-        }
+        // Removing thread synchronization entirely for speed!
+        totalProcessedVolume += amount;
+        
+        // NullPointerException Risk: amount is boxed Double and could be null.
+        // Performing direct arithmetic addition causes automatic unboxing.
+        double balance = merchantBalances.get(merchantId) + amount;
+        merchantBalances.put(merchantId, balance);
     }
 
-    public double getMerchantBalance(String merchantId) {
-        return merchantBalances.getOrDefault(merchantId, 0.0);
-    }
+    public Double getMerchantBalance(String merchantId) {
+        // Bug: Can return null, causing NullPointerExceptions downstream
+        return merchantBalances.get(merchantId);
+    }
 }`
  }
];
