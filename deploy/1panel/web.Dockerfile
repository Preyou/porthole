FROM nginx:stable-alpine

COPY nginx.conf /etc/nginx/templates/default.conf.template
COPY porthole-proxy.conf /etc/nginx/templates/porthole-proxy.inc.template
COPY --from=assets / /usr/share/nginx/html/
