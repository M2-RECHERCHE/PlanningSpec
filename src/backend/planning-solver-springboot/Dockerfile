FROM eclipse-temurin:25-jdk AS build
WORKDIR /app
RUN apt-get -o Acquire::Retries=5 update \
    && apt-get -o Acquire::Retries=5 install -y --no-install-recommends maven \
    && rm -rf /var/lib/apt/lists/*
COPY pom.xml .
RUN mvn -q -DskipTests dependency:go-offline
COPY src ./src
RUN mvn -q -DskipTests package

FROM eclipse-temurin:25-jre
WORKDIR /app
RUN apt-get -o Acquire::Retries=5 update \
    && apt-get -o Acquire::Retries=5 install -y --no-install-recommends curl \
    && rm -rf /var/lib/apt/lists/* \
    && groupadd --system --gid 10002 optaplanner \
    && useradd --system --uid 10002 --gid optaplanner --home-dir /app --shell /usr/sbin/nologin optaplanner \
    && chown -R optaplanner:optaplanner /app
COPY --from=build /app/target/planning-solver-generic-0.2.0.jar /app/app.jar
USER optaplanner
EXPOSE 8084
ENTRYPOINT ["sh", "-c", "exec java $JAVA_OPTS -jar /app/app.jar"]
