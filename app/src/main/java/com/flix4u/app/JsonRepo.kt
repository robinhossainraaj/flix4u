package com.flix4u.app

import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonArray
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.contentOrNull
import kotlinx.serialization.json.jsonPrimitive
import java.net.HttpURLConnection
import java.net.URL

data class StreamItem(
    val id: String,
    val title: String,
    val description: String,
    val url: String,
    val category: String,
    val logo: String
)

object Repo {
    const val USER = "robinhossainraaj"
    const val REPO = "flix4u"
    const val BRANCH = "main"
    const val PATH = "channels.json"
    val RAW_URL: String
        get() = "https://raw.githubusercontent.com/$USER/$REPO/$BRANCH/$PATH"
}

object JsonRepo {
    private val json = Json { ignoreUnknownKeys = true; isLenient = true }

    fun fetchStreams(): List<StreamItem> {
        val conn = (URL(Repo.RAW_URL).openConnection() as HttpURLConnection).apply {
            connectTimeout = 15000
            readTimeout = 15000
            setRequestProperty("Accept", "application/json")
        }
        try {
            val body = conn.inputStream.bufferedReader().use { it.readText() }
            return parse(body)
        } finally {
            conn.disconnect()
        }
    }

    fun parse(body: String): List<StreamItem> {
        val root = json.parseToJsonElement(body)
        val array: JsonArray = when (root) {
            is JsonArray -> root
            is JsonObject -> root["streams"] as? JsonArray
                ?: root["channels"] as? JsonArray
                ?: JsonArray(emptyList())
            else -> JsonArray(emptyList())
        }
        return array.mapNotNull { el ->
            val o = el as? JsonObject ?: return@mapNotNull null
            fun s(k: String) = o[k]?.jsonPrimitive?.contentOrNull ?: ""
            val url = s("url").ifBlank { s("m3u8") }
            if (url.isBlank()) return@mapNotNull null
            StreamItem(
                id = s("id").ifBlank { url.hashCode().toString() },
                title = s("title").ifBlank { s("name") },
                description = s("description"),
                url = url,
                category = s("category"),
                logo = s("logo").ifBlank { s("logo_url") }
            )
        }
    }
}
