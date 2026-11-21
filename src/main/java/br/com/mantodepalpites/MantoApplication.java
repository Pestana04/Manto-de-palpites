package br.com.mantodepalpites;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.scheduling.annotation.EnableScheduling;

@EnableScheduling
@SpringBootApplication
public class MantoApplication {
    public static void main(String[] args) { SpringApplication.run(MantoApplication.class, args); }
}
