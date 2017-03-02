FROM node:latest

COPY . /app/
WORKDIR /app/

RUN npm install && npm link

ENTRYPOINT ["scs-commander"]
