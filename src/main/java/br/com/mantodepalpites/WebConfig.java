package br.com.mantodepalpites;

import jakarta.servlet.*;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;
import jakarta.servlet.http.HttpServletRequest;
import java.io.IOException;

@Component
public class WebConfig extends OncePerRequestFilter {
    @Override protected void doFilterInternal(HttpServletRequest request,HttpServletResponse response,FilterChain chain) throws ServletException,IOException {
        response.setHeader("Content-Security-Policy","default-src 'self'; img-src 'self' data:; style-src 'self'; script-src 'self'; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'");
        response.setHeader("X-Content-Type-Options","nosniff");
        response.setHeader("Referrer-Policy","same-origin");
        if(request.getRequestURI().startsWith("/api/")) response.setHeader("Cache-Control","no-store");
        chain.doFilter(request,response);
    }
}
