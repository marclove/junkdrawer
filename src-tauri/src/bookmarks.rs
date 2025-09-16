use anyhow::Result;
use reqwest::Client;
use serde::{Deserialize, Serialize};
use std::time::Duration;
use thiserror::Error;
use tokio::time::timeout;

const REQUEST_TIMEOUT: Duration = Duration::from_secs(10);
const MAX_RETRIES: usize = 2;
const RETRY_DELAY: Duration = Duration::from_millis(500);

#[derive(Error, Debug)]
pub enum BookmarkError {
    #[error("Invalid URL: {0}")]
    InvalidUrl(String),
    #[error("Network error: {0}")]
    Network(#[from] reqwest::Error),
    #[error("Request timeout")]
    Timeout,
    #[error("No title found in page")]
    NoTitle,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BookmarkMetadata {
    pub title: String,
    pub description: Option<String>,
    pub url: String,
    pub favicon_url: Option<String>,
}

pub struct BookmarkProcessor {
    client: Client,
}

impl BookmarkProcessor {
    pub fn new() -> Self {
        let client = Client::builder()
            .timeout(REQUEST_TIMEOUT)
            .user_agent("Junkdrawer/0.1.0")
            .build()
            .expect("Failed to create HTTP client");

        Self { client }
    }

    pub async fn fetch_metadata(&self, url: &str) -> Result<BookmarkMetadata, BookmarkError> {
        // Validate URL format
        let parsed_url = reqwest::Url::parse(url)
            .map_err(|_| BookmarkError::InvalidUrl(url.to_string()))?;

        // Retry logic with exponential backoff
        let mut last_error = None;
        for attempt in 0..=MAX_RETRIES {
            match self.fetch_metadata_attempt(&parsed_url).await {
                Ok(metadata) => return Ok(metadata),
                Err(e) => {
                    last_error = Some(e);
                    if attempt < MAX_RETRIES {
                        tokio::time::sleep(RETRY_DELAY * (2_u32.pow(attempt as u32))).await;
                    }
                }
            }
        }

        Err(last_error.unwrap())
    }

    async fn fetch_metadata_attempt(
        &self,
        url: &reqwest::Url,
    ) -> Result<BookmarkMetadata, BookmarkError> {
        // Fetch HTML with timeout
        let response = timeout(REQUEST_TIMEOUT, self.client.get(url.clone()).send())
            .await
            .map_err(|_| BookmarkError::Timeout)?
            .map_err(BookmarkError::Network)?;

        let html = timeout(REQUEST_TIMEOUT, response.text())
            .await
            .map_err(|_| BookmarkError::Timeout)?
            .map_err(BookmarkError::Network)?;

        self.parse_metadata(url.as_str(), &html)
    }

    fn parse_metadata(&self, url: &str, html: &str) -> Result<BookmarkMetadata, BookmarkError> {
        // Simple regex-based extraction for now to avoid HTML parsing complexity
        let title = self.extract_title(html).ok_or(BookmarkError::NoTitle)?;
        let description = self.extract_description(html);
        
        Ok(BookmarkMetadata {
            title,
            description,
            url: url.to_string(),
            favicon_url: None, // Skip favicon for now
        })
    }

    fn extract_title(&self, html: &str) -> Option<String> {
        // Look for <title> tag
        if let Some(start) = html.find("<title>") {
            if let Some(end) = html[start + 7..].find("</title>") {
                let title = &html[start + 7..start + 7 + end];
                return Some(title.trim().to_string());
            }
        }
        
        // Look for og:title
        if let Some(pos) = html.find("property=\"og:title\"") {
            if let Some(content_start) = html[pos..].find("content=\"") {
                let content_pos = pos + content_start + 9;
                if let Some(content_end) = html[content_pos..].find('"') {
                    let title = &html[content_pos..content_pos + content_end];
                    return Some(title.trim().to_string());
                }
            }
        }
        
        None
    }

    fn extract_description(&self, html: &str) -> Option<String> {
        // Look for meta description
        if let Some(pos) = html.find("name=\"description\"") {
            if let Some(content_start) = html[pos..].find("content=\"") {
                let content_pos = pos + content_start + 9;
                if let Some(content_end) = html[content_pos..].find('"') {
                    let description = &html[content_pos..content_pos + content_end];
                    return Some(description.trim().to_string());
                }
            }
        }
        
        // Look for og:description
        if let Some(pos) = html.find("property=\"og:description\"") {
            if let Some(content_start) = html[pos..].find("content=\"") {
                let content_pos = pos + content_start + 9;
                if let Some(content_end) = html[content_pos..].find('"') {
                    let description = &html[content_pos..content_pos + content_end];
                    return Some(description.trim().to_string());
                }
            }
        }
        
        None
    }
}

impl Default for BookmarkProcessor {
    fn default() -> Self {
        Self::new()
    }
}