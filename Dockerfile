FROM node

WORKDIR /app

COPY package.json package-lock.json ./ 

RUN npm install --production

COPY . .

COPY entrypoint.sh /usr/src/app/entrypoint.sh
RUN chmod +x /usr/src/app/entrypoint.sh

CMD ["/usr/src/app/entrypoint.sh"]
