FROM node:latest

WORKDIR /frontend

COPY package.json package-lock.json* ./

RUN npm install --legacy-peer-deps
