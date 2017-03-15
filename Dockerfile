FROM node:onbuild

RUN npm link

ENTRYPOINT ["scs-commander"]
