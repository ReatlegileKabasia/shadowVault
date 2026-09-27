package com.example.shadowvault.security;

import jakarta.servlet.ReadListener;
import jakarta.servlet.ServletException;
import jakarta.servlet.ServletInputStream;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletRequestWrapper;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.http.HttpStatus;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.BufferedReader;
import java.io.IOException;
import java.io.InputStreamReader;
import java.nio.charset.Charset;

public class RequestBodyLimitFilter extends OncePerRequestFilter {

    private static final String API_PREFIX = "/api/";
    private static final String REKEY_PATH = "/api/incidents/rekey";

    private final long standardLimit;
    private final long rekeyLimit;

    public RequestBodyLimitFilter(long standardLimit, long rekeyLimit) {
        if (standardLimit < 1 || rekeyLimit < standardLimit) {
            throw new IllegalArgumentException("Request body limits must be positive and ordered.");
        }
        this.standardLimit = standardLimit;
        this.rekeyLimit = rekeyLimit;
    }

    @Override
    protected boolean shouldNotFilter(HttpServletRequest request) {
        return !request.getRequestURI()
                .substring(request.getContextPath().length())
                .startsWith(API_PREFIX);
    }

    @Override
    protected void doFilterInternal(
            HttpServletRequest request,
            HttpServletResponse response,
            jakarta.servlet.FilterChain filterChain) throws ServletException, IOException {
        String path = request.getRequestURI().substring(request.getContextPath().length());
        long limit = REKEY_PATH.equals(path) ? rekeyLimit : standardLimit;
        if (request.getContentLengthLong() > limit) {
            rejectOversizedRequest(response);
            return;
        }
        filterChain.doFilter(new LimitedBodyRequest(request, limit), response);
    }

    private static void rejectOversizedRequest(HttpServletResponse response) throws IOException {
        response.setStatus(HttpStatus.CONTENT_TOO_LARGE.value());
        response.setHeader("Cache-Control", "no-store");
        response.setContentType("application/json");
        response.setCharacterEncoding("UTF-8");
        response.getWriter().write("{\"error\":\"Request body is too large.\"}");
    }

    private static final class LimitedBodyRequest extends HttpServletRequestWrapper {

        private final long limit;
        private ServletInputStream inputStream;
        private BufferedReader reader;

        private LimitedBodyRequest(HttpServletRequest request, long limit) {
            super(request);
            this.limit = limit;
        }

        @Override
        public ServletInputStream getInputStream() throws IOException {
            if (reader != null) {
                throw new IllegalStateException("The request reader has already been obtained.");
            }
            if (inputStream == null) {
                inputStream = new LimitedServletInputStream(super.getInputStream(), limit);
            }
            return inputStream;
        }

        @Override
        public BufferedReader getReader() throws IOException {
            if (inputStream != null) {
                throw new IllegalStateException("The request input stream has already been obtained.");
            }
            if (reader == null) {
                Charset charset = getCharacterEncoding() == null
                        ? Charset.defaultCharset()
                        : Charset.forName(getCharacterEncoding());
                reader = new BufferedReader(new InputStreamReader(getInputStream(), charset));
            }
            return reader;
        }
    }

    private static final class LimitedServletInputStream extends ServletInputStream {

        private final ServletInputStream delegate;
        private final long limit;
        private long bytesRead;

        private LimitedServletInputStream(ServletInputStream delegate, long limit) {
            this.delegate = delegate;
            this.limit = limit;
        }

        @Override
        public int read() throws IOException {
            int value = delegate.read();
            if (value >= 0) {
                count(1);
            }
            return value;
        }

        @Override
        public int read(byte[] bytes, int offset, int length) throws IOException {
            if (length == 0) {
                return 0;
            }
            long remainingWithOverflowByte = limit - bytesRead + 1;
            int permittedLength = (int) Math.min(length, remainingWithOverflowByte);
            int count = delegate.read(bytes, offset, permittedLength);
            if (count > 0) {
                count(count);
            }
            return count;
        }

        private void count(long count) throws IOException {
            bytesRead += count;
            if (bytesRead > limit) {
                throw new IOException("Request body exceeds the configured size limit.");
            }
        }

        @Override
        public boolean isFinished() {
            return delegate.isFinished();
        }

        @Override
        public boolean isReady() {
            return delegate.isReady();
        }

        @Override
        public void setReadListener(ReadListener readListener) {
            delegate.setReadListener(readListener);
        }
    }
}
