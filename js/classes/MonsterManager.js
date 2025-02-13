      class MonsterManager {
        constructor(mapEditor) {
          this.mapEditor = mapEditor;
          this.monsterDatabase = this.loadDatabase();
          this.baseTokenUrl = "https://5e.tools/img/bestiary/tokens/";
        }

        async storeMonsterImage(imgElement) {
          try {
            // Create a canvas to convert the image
            const canvas = document.createElement("canvas");
            canvas.width = imgElement.naturalWidth;
            canvas.height = imgElement.naturalHeight;
            const ctx = canvas.getContext("2d");
            ctx.drawImage(imgElement, 0, 0);

            // Convert to base64
            const base64Image = canvas.toDataURL("image/webp");
            return base64Image;
          } catch (error) {
            console.error("Error converting monster image:", error);
            return null;
          }
        }

        loadDatabase() {
          try {
            const dbText = localStorage.getItem("monsterDatabase");
            return dbText ? JSON.parse(dbText) : { monsters: {} };
          } catch (e) {
            console.error("Error loading monster database:", e);
            return { monsters: {} };
          }
        }

        async saveMonsterToDatabase(monsterData) {
          const key = monsterData.basic.name.toLowerCase().replace(/\s+/g, "_");
          this.monsterDatabase.monsters[key] = monsterData;
          localStorage.setItem(
            "monsterDatabase",
            JSON.stringify(this.monsterDatabase)
          );
        }

        getTokenUrl(tokenPath) {
          // Clean up any double slashes and ensure proper path construction
          return this.baseTokenUrl + tokenPath.replace(/^\//, "");
        }

        tryStoreToken(tokenUrl) {
    return fetch(tokenUrl, {
        mode: 'cors',
        headers: {
            'Accept': 'image/webp,*/*'
        }
    })
    .then(response => {
        if (!response.ok) throw new Error('Failed to fetch token');
        return response.blob();
    })
    .then(blob => {
        return new Promise((resolve) => {
            const reader = new FileReader();
            reader.onloadend = () => {
                resolve(reader.result);
            };
            reader.readAsDataURL(blob);
        });
    })
    .catch(error => {
        console.log('Failed to fetch token directly:', error);
        return tokenUrl; // Return URL as fallback
    });
}

        // Complete showMonsterSelector method for MonsterManager class
        async showMonsterSelector(marker) {
          const dialog = document.createElement("sl-dialog");
          dialog.label = "Import Monster";
          dialog.innerHTML = `
        <div style="display: flex; flex-direction: column; gap: 16px;">
            <div class="instructions" style="background: #f5f5f5; padding: 12px; border-radius: 4px;">
                <p style="margin-top: 0;">To import monster data from 5e.tools:</p>
                <ol style="margin-left: 20px; margin-bottom: 0;">
                    <li>On 5e.tools, right-click on the monster's stat block</li>
                    <li>Select "Inspect Element" or press F12</li>
                    <li>Find the <code>&lt;div id="wrp-pagecontent"&gt;</code> element</li>
                    <li>Right-click the element and select:
                        <ul style="margin-left: 20px;">
                            <li>In Chrome/Edge: "Copy > Copy element"</li>
                            <li>In Firefox: "Copy > Outer HTML"</li>
                        </ul>
                    </li>
                    <li>Paste below</li>
                </ol>
            </div>
            
            <textarea id="monsterHtml" 
                rows="10" 
                style="width: 100%; font-family: monospace; padding: 8px;"
                placeholder="Paste monster stat block HTML here..."></textarea>

            <div id="monsterPreview" style="display: none; max-height: 60vh; overflow-y: auto;">
                <!-- Basic Info Section -->
                <div class="monster-header" style="margin-bottom: 16px;">
                    <h3 class="monster-name" style="margin: 0; font-size: 1.5em;"></h3>
                    <div style="color: #666; font-style: italic;">
                        <span class="monster-size"></span>
                        <span class="monster-type"></span>,
                        <span class="monster-alignment"></span>
                    </div>
                </div>

                <!-- Monster Image -->
                <div class="monster-image" style="margin-bottom: 16px; text-align: center;">
                    <img style="max-width: 200px; display: none;" />
                </div>

                <!-- Core Stats -->
                <div class="core-stats" style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; margin-bottom: 16px; text-align: center; background: #f5f5f5; padding: 8px; border-radius: 4px;">
                    <div>
                        <div style="font-weight: bold;">Armor Class</div>
                        <div class="monster-ac"></div>
                    </div>
                    <div>
                        <div style="font-weight: bold;">Hit Points</div>
                        <div class="monster-hp"></div>
                    </div>
                    <div>
                        <div style="font-weight: bold;">Speed</div>
                        <div class="monster-speed"></div>
                    </div>
                </div>

                <!-- Ability Scores -->
                <div class="ability-scores" style="display: grid; grid-template-columns: repeat(6, 1fr); gap: 8px; margin-bottom: 16px; text-align: center; background: #f5f5f5; padding: 8px; border-radius: 4px;">
                    <div>
                        <div style="font-weight: bold;">STR</div>
                        <div class="monster-str"></div>
                    </div>
                    <div>
                        <div style="font-weight: bold;">DEX</div>
                        <div class="monster-dex"></div>
                    </div>
                    <div>
                        <div style="font-weight: bold;">CON</div>
                        <div class="monster-con"></div>
                    </div>
                    <div>
                        <div style="font-weight: bold;">INT</div>
                        <div class="monster-int"></div>
                    </div>
                    <div>
                        <div style="font-weight: bold;">WIS</div>
                        <div class="monster-wis"></div>
                    </div>
                    <div>
                        <div style="font-weight: bold;">CHA</div>
                        <div class="monster-cha"></div>
                    </div>
                </div>

                <!-- Additional Traits -->
                <div class="additional-traits" style="margin-bottom: 16px;">
                    <div style="margin-bottom: 8px;">
                        <strong>Challenge Rating:</strong> <span class="monster-cr"></span>
                        (<span class="monster-xp"></span> XP)
                    </div>
                    <div style="margin-bottom: 8px;">
                        <strong>Proficiency Bonus:</strong> <span class="monster-prof"></span>
                    </div>
                    <div style="margin-bottom: 8px;">
                        <strong>Senses:</strong> <span class="monster-senses"></span>
                    </div>
                    <div style="margin-bottom: 8px;">
                        <strong>Languages:</strong> <span class="monster-languages"></span>
                    </div>
                    <div class="monster-immunities-container" style="margin-bottom: 8px; display: none;">
                        <strong>Immunities:</strong> <span class="monster-immunities"></span>
                    </div>
                </div>
            </div>

            <div id="loadingIndicator" style="display: none; text-align: center;">
                <sl-spinner></sl-spinner>
                <div>Processing monster data...</div>
            </div>

            <div id="errorMessage" style="display: none; color: #f44336;"></div>
        </div>
        <div slot="footer">
            <sl-button variant="neutral" class="cancel-btn">Cancel</sl-button>
            <sl-button variant="primary" class="save-btn" disabled>Save Monster</sl-button>
        </div>
    `;

          document.body.appendChild(dialog);
          dialog.show();

          const htmlInput = dialog.querySelector("#monsterHtml");
          const saveBtn = dialog.querySelector(".save-btn");
          const cancelBtn = dialog.querySelector(".cancel-btn");
          const loadingIndicator = dialog.querySelector("#loadingIndicator");
          const errorMessage = dialog.querySelector("#errorMessage");
          const preview = dialog.querySelector("#monsterPreview");

          let currentMonsterData = null;

          // Handle HTML paste
          htmlInput.addEventListener("input", async () => {
            const html = htmlInput.value.trim();
            if (html) {
              try {
                loadingIndicator.style.display = "block";
                errorMessage.style.display = "none";
                preview.style.display = "none";
                saveBtn.disabled = true;

                // Add await here since parseMonsterHtml returns a Promise now
                currentMonsterData = await this.parseMonsterHtml(html);
                // console.log("Parsed monster data:", currentMonsterData); // Debug log

                if (currentMonsterData) {
                  // Update basic info
                  preview.querySelector(".monster-name").textContent =
                    currentMonsterData.basic.name;
                  preview.querySelector(".monster-size").textContent =
                    currentMonsterData.basic.size;
                  preview.querySelector(".monster-type").textContent =
                    currentMonsterData.basic.type;
                  preview.querySelector(".monster-alignment").textContent =
                    currentMonsterData.basic.alignment;

                  // Update core stats
                  preview.querySelector(".monster-ac").textContent =
                    currentMonsterData.stats.ac;
                  preview.querySelector(
                    ".monster-hp"
                  ).textContent = `${currentMonsterData.stats.hp.average} (${currentMonsterData.stats.hp.roll})`;
                  preview.querySelector(".monster-speed").textContent =
                    currentMonsterData.stats.speed;

                  // Update ability scores
                  Object.entries(currentMonsterData.abilities).forEach(
                    ([ability, data]) => {
                      const element = preview.querySelector(
                        `.monster-${ability}`
                      );
                      if (element) {
                        element.textContent = `${data.score} (${
                          data.modifier >= 0 ? "+" : ""
                        }${data.modifier})`;
                      }
                    }
                  );

                  // Update additional traits
                  preview.querySelector(".monster-cr").textContent =
                    currentMonsterData.basic.cr;
                  preview.querySelector(".monster-xp").textContent =
                    currentMonsterData.basic.xp;
                  preview.querySelector(
                    ".monster-prof"
                  ).textContent = `+${currentMonsterData.basic.proficiencyBonus}`;
                  preview.querySelector(".monster-senses").textContent =
                    currentMonsterData.traits.senses.join(", ") || "None";
                  preview.querySelector(".monster-languages").textContent =
                    currentMonsterData.traits.languages;

                  // Handle immunities
                  const immunitiesContainer = preview.querySelector(
                    ".monster-immunities-container"
                  );
                  const immunitiesSpan = preview.querySelector(
                    ".monster-immunities"
                  );
                  if (currentMonsterData.traits.immunities.length > 0) {
                    immunitiesSpan.textContent =
                      currentMonsterData.traits.immunities.join(", ");
                    immunitiesContainer.style.display = "block";
                  } else {
                    immunitiesContainer.style.display = "none";
                  }



                const imgElement = preview.querySelector(".monster-image img");
if (currentMonsterData.token && (currentMonsterData.token.data || currentMonsterData.token.url)) {
    const imageUrl = currentMonsterData.token.data || currentMonsterData.token.url;
    try {
        const base64Data = await this.tryFetchImage(imageUrl);
        if (base64Data) {
            currentMonsterData.token.data = base64Data;
            console.log("Successfully captured token as base64");
        }
    } catch (error) {
        console.error("Error fetching token:", error);
    }
    
    imgElement.src = imageUrl;
    imgElement.style.display = "block";
} else {
    imgElement.style.display = "none";
}

                  preview.style.display = "block";
                  saveBtn.disabled = false;
                }
              } catch (error) {
                console.error("Error in monster data processing:", error); // More detailed error log
                errorMessage.textContent =
                  "Error parsing monster data. Please check the HTML.";
                errorMessage.style.display = "block";
                saveBtn.disabled = true;
              } finally {
                loadingIndicator.style.display = "none";
              }
            }
          });

          return new Promise((resolve) => {


            saveBtn.addEventListener("click", async () => {
    if (currentMonsterData) {
        // At this point, currentMonsterData.token.data should already have the base64 data
        // from when the preview image loaded
        marker.data.monster = currentMonsterData;
        await this.saveMonsterToDatabase(currentMonsterData);
        this.mapEditor.updateMarkerAppearance(marker);
        dialog.hide();
        resolve(true);
    }
});

            cancelBtn.addEventListener("click", () => {
              dialog.hide();
              resolve(false);
            });

            dialog.addEventListener("sl-after-hide", () => {
              dialog.remove();
            });
          });
        }

        async tryFetchImage(url) {
    try {
        const response = await fetch(url, {
            mode: 'no-cors',
            cache: 'no-cache',
            referrerPolicy: 'no-referrer'
        });
        const blob = await response.blob();
        return new Promise((resolve) => {
            const reader = new FileReader();
            reader.onloadend = () => resolve(reader.result);
            reader.readAsDataURL(blob);
        });
    } catch (error) {
        console.error("Error fetching image:", error);
        return null;
    }
}

        // In MonsterManager class
        async extractMonsterData(url) {
          try {
            // Parse the URL to get monster ID
            const monsterId = url.split("#")[1]; // e.g., "zombie_xphb"
            if (!monsterId) {
              throw new Error("Invalid monster URL format");
            }

            // Since we can't fetch directly from 5e.tools,
            // we'll need the user to paste the monster data section
            const dialog = document.createElement("sl-dialog");
            dialog.label = "Monster Data Import";
            dialog.innerHTML = `
    <div style="display: flex; flex-direction: column; gap: 16px;">
        <div class="instructions">
            <p>To import monster data from 5e.tools:</p>
            <ol style="margin-left: 20px;">
                <li>On 5e.tools, right-click on the monster's stat block</li>
                <li>Select "Inspect Element" or press F12</li>
                <li>Find the <code>&lt;div id="wrp-pagecontent"&gt;</code> element</li>
                <li>Right-click the element and select:</li>
                <ul style="margin-left: 20px;">
                    <li>In Firefox: "Copy > Outer HTML"</li>
                    <li>In Chrome: "Copy > Copy element"</li>
                    <li>In Edge: "Copy > Outer HTML"</li>
                </ul>
                <li>Paste it below</li>
            </ol>
        </div>
        <div class="visual-guide" style="margin-top: 10px; padding: 10px; background: #f5f5f5; border-radius: 4px;">
            <p style="margin: 0 0 10px 0;"><strong>The element should look like this:</strong></p>
            <pre style="background: #fff; padding: 10px; border-radius: 4px; margin: 0; font-size: 0.9em; overflow-x: auto;"><code>&lt;div id="wrp-pagecontent" class="relative wrp-stats-table..."&gt;</code></pre>
        </div>
        <textarea id="monsterHtml" 
                 rows="10" 
                 style="width: 100%; font-family: monospace;"
                 placeholder="Paste monster stat block HTML here..."></textarea>
        <div id="errorMessage" style="display: none; color: #f44336;"></div>
    </div>
    <div slot="footer">
        <sl-button variant="neutral" class="cancel-btn">Cancel</sl-button>
        <sl-button variant="primary" class="import-btn">Import Monster</sl-button>
    </div>
`;

            document.body.appendChild(dialog);
            dialog.show();

            return new Promise((resolve, reject) => {
              const importBtn = dialog.querySelector(".import-btn");
              const cancelBtn = dialog.querySelector(".cancel-btn");
              const errorMsg = dialog.querySelector("#errorMessage");

              importBtn.addEventListener("click", () => {
                const html = dialog.querySelector("#monsterHtml").value;
                try {
                  const monsterData = this.parseMonsterHtml(html);
                  dialog.hide();
                  resolve(monsterData);
                } catch (error) {
                  errorMsg.textContent =
                    "Error parsing monster data. Please check the HTML.";
                  errorMsg.style.display = "block";
                }
              });

              cancelBtn.addEventListener("click", () => {
                dialog.hide();
                reject(new Error("Import cancelled"));
              });

              dialog.addEventListener("sl-after-hide", () => {
                dialog.remove();
              });
            });
          } catch (error) {
            console.error("Error extracting monster data:", error);
            throw error;
          }
        }

        parseMonsterHtml(html) {
        //   console.log("Starting to parse monster HTML"); // Debug 1
          const parser = new DOMParser();
          const doc = parser.parseFromString(html, "text/html");
        //   console.log("HTML parsed into document"); // Debug 2

          try {
            // Required basic information
            const name =
              doc.querySelector(".stats__h-name")?.textContent?.trim() ||
              "Unknown Monster";
            // console.log("Found name:", name); // Debug 3

            const typeInfo =
              doc.querySelector("td i")?.textContent?.trim() ||
              "Medium Unknown, Unaligned";
            // console.log("Found typeInfo:", typeInfo); // Debug 4

            // Parse type info with defaults
            const [sizeTypeAlign = ""] = typeInfo.split(",");
            const [size = "Medium", type = "Unknown"] = sizeTypeAlign
              .trim()
              .split(/\s+/);
            const alignment = typeInfo.split(",")[1]?.trim() || "Unaligned";

            // Required stats (with safe defaults)
            const stats = {
              ac: parseInt(
                doc.querySelector('[title="Armor Class"] + span')
                  ?.textContent || "10"
              ),
              hp: {
                average: parseInt(
                  doc.querySelector('[title="Hit Points"] + span')
                    ?.textContent || "1"
                ),
                roll:
                  doc
                    .querySelector('[data-roll-name="Hit Points"]')
                    ?.textContent?.trim() || "1d4",
                max: parseInt(
                  doc.querySelector('[title="Maximum: "]')?.textContent || "1"
                )
              },
              speed: "30 ft."
            };

            // Try to get actual speed
            const speedNode = Array.from(doc.querySelectorAll("strong")).find(
              (el) => el.textContent === "Speed"
            );
            if (speedNode && speedNode.nextSibling) {
              stats.speed = speedNode.nextSibling.textContent.trim();
            }

            // Parse ability scores - Updated version
            // console.log("About to parse ability scores");
            // Parse ability scores
            const abilities = {};
            const abilityRows = Array.from(
              doc.querySelectorAll(".stats-tbl-ability-scores__lbl-abv")
            );

            abilityRows.forEach((labelCell) => {
              const abilityDiv = labelCell.querySelector(".bold.small-caps");
              if (abilityDiv) {
                const abilityName = abilityDiv.textContent.trim().toLowerCase();
                if (
                  ["str", "dex", "con", "int", "wis", "cha"].includes(
                    abilityName
                  )
                ) {
                  try {
                    // Get score from the next cell's div directly
                    const scoreDiv =
                      labelCell.nextElementSibling.querySelector(
                        ".ve-text-center"
                      );
                    const score = parseInt(scoreDiv?.textContent || "10");

                    // Get modifier from the next cell's roller span
                    const modifierCell =
                      scoreDiv?.parentElement.nextElementSibling;
                    const modifierText =
                      modifierCell?.querySelector(".roller")?.textContent ||
                      "0";
                    const modifier = parseInt(
                      modifierText.match(/[+-]\d+/)?.[0] || "0"
                    );

                    abilities[abilityName] = { score, modifier };
                    // console.log(`Parsed ${abilityName}:`, { score, modifier });
                  } catch (e) {
                    console.error(`Error parsing ${abilityName}:`, e);
                    abilities[abilityName] = { score: 10, modifier: 0 };
                  }
                }
              }
            });
            // console.log("Abilities parsed successfully:", abilities);

            // Optional extras
            let extras = {
              immunities: [],
              resistances: [],
              senses: [],
              languages: "None",
              cr: "0",
              xp: 0,
              proficiencyBonus: 2
            };

            try {
              const crNode = doc.querySelector(
                '[title="Challenge Rating"] + span'
              );
              if (crNode) {
                extras.cr = crNode.textContent.split("(")[0].trim();
                const xpMatch = crNode.textContent.match(/XP (\d+)/);
                if (xpMatch) extras.xp = parseInt(xpMatch[1]);
                // console.log("Parsed CR/XP:", extras.cr, extras.xp);
              }
            } catch (e) {
              console.log("Optional: Failed to parse CR/XP");
            }

            try {
              const immunityNode = Array.from(
                doc.querySelectorAll("strong")
              ).find((el) => el.textContent === "Immunities");
              if (immunityNode && immunityNode.nextSibling) {
                extras.immunities = immunityNode.nextSibling.textContent
                  .split(";")
                  .map((i) => i.trim())
                  .filter((i) => i);
                // console.log("Parsed immunities:", extras.immunities);
              }
            } catch (e) {
              console.log("Optional: Failed to parse immunities");
            }

            try {
              const sensesNode = Array.from(
                doc.querySelectorAll("strong")
              ).find((el) => el.textContent === "Senses");
              if (sensesNode && sensesNode.nextSibling) {
                extras.senses = sensesNode.nextSibling.textContent
                  .split(",")
                  .map((s) => s.trim())
                  .filter((s) => s);
                // console.log("Parsed senses:", extras.senses);
              }
            } catch (e) {
              console.log("Optional: Failed to parse senses");
            }

            try {
              const languagesNode = Array.from(
                doc.querySelectorAll("strong")
              ).find((el) => el.textContent === "Languages");
              if (languagesNode && languagesNode.nextSibling) {
                extras.languages =
                  languagesNode.nextSibling.textContent.trim() || "None";
                // console.log("Parsed languages:", extras.languages);
              }
            } catch (e) {
              console.log("Optional: Failed to parse languages");
            }

            // console.log("Starting token handling");
            // Token handling with proper error handling
            let tokenUrl = null;
            const tokenDiv = doc.querySelector("#float-token");
            if (tokenDiv) {
              const imgElement = tokenDiv.querySelector("img.stats__token");
              if (imgElement && imgElement.src) {
                const path = imgElement.src.replace(
                  /.*\/bestiary\/tokens\//,
                  ""
                );
                tokenUrl = this.getTokenUrl(path);
                // console.log("TokenDiv-Token URL:", tokenUrl); // Debug log
              } else {
                const linkElement =
                  tokenDiv.querySelector("a.stats__wrp-token");
                if (linkElement && linkElement.href) {
                  const path = linkElement.href.replace(
                    /.*\/bestiary\/tokens\//,
                    ""
                  );
                  tokenUrl = this.getTokenUrl(path);
                  console.log("Fallback-Token URL:", tokenUrl); // Debug log
                }
              }

              // If we found a token URL, try to store it
              if (tokenUrl) {
                // console.log("Attempting to store token...");
                return this.tryStoreToken(tokenUrl)
                  .then((tokenData) => {
                    // console.log(
                    //   "Token stored successfully:",
                    //   tokenData ? "data present" : "no data"
                    // );
                    return {
                      basic: {
                        name,
                        size,
                        type,
                        alignment,
                        cr: extras.cr,
                        xp: extras.xp,
                        proficiencyBonus: extras.proficiencyBonus
                      },
                      stats,
                      abilities,
                      traits: {
                        immunities: extras.immunities,
                        senses: extras.senses,
                        languages: extras.languages
                      },
                      token: {
                        url: tokenUrl,
                        data: tokenData
                      }
                    };
                  })
                  .catch((error) => {
                    console.error("Error storing token:", error);
                    // Return data with null token data in case of error
                    return {
                      basic: {
                        name,
                        size,
                        type,
                        alignment,
                        cr: extras.cr,
                        xp: extras.xp,
                        proficiencyBonus: extras.proficiencyBonus
                      },
                      stats,
                      abilities,
                      traits: {
                        immunities: extras.immunities,
                        senses: extras.senses,
                        languages: extras.languages
                      },
                      token: {
                        url: tokenUrl,
                        data: null
                      }
                    };
                  });
              }
            }
            // console.log("Token handling complete");
            // console.log("Returning monster data...");
            // Return data without token if no token URL was found
            return {
              basic: {
                name,
                size,
                type,
                alignment,
                cr: extras.cr,
                xp: extras.xp,
                proficiencyBonus: extras.proficiencyBonus
              },
              stats,
              abilities,
              traits: {
                immunities: extras.immunities,
                senses: extras.senses,
                languages: extras.languages
              },
              token: {
                url: tokenUrl,
                data: null
              }
            };
          } catch (error) {
            console.error("Error parsing monster HTML:", error);
            // Return a minimal valid monster object
            return {
              basic: {
                name: "Unknown Monster",
                size: "Medium",
                type: "Unknown",
                alignment: "Unaligned",
                cr: "0",
                xp: 0,
                proficiencyBonus: 2
              },
              stats: {
                ac: 10,
                hp: { average: 1, roll: "1d4", max: 1 },
                speed: "30 ft."
              },
              abilities: {
                str: { score: 10, modifier: 0 },
                dex: { score: 10, modifier: 0 },
                con: { score: 10, modifier: 0 },
                int: { score: 10, modifier: 0 },
                wis: { score: 10, modifier: 0 },
                cha: { score: 10, modifier: 0 }
              },
              traits: {
                immunities: [],
                senses: [],
                languages: "None"
              }
            };
          }
        //   console.log("Monster HTML parsing complete");
        }

        getStoredToken(monsterId) {
          try {
            const key = `monster_token_${monsterId}`;
            return localStorage.getItem(key);
          } catch (e) {
            console.error("Error retrieving stored token:", e);
            return null;
          }
        }

        cloneEncounter(marker) {
          // Clone an existing encounter marker
          const offset = 50;

          if (marker.type === "encounter" && marker.data.monster) {
            // Get the monster's size and calculate dimensions
            const monsterSize = this.mapEditor.getMonsterSizeInSquares(
              marker.data.monster.basic.size
            );
            const baseSize = 32;
            const scaledSize = baseSize * monsterSize /2 ;

            console.log("Size calculations:", {
              monsterSize,
              baseSize,
              scaledSize
            });

            // Create new marker
            const newMarker = this.mapEditor.addMarker(
              "encounter",
              marker.x + offset,
              marker.y + offset,
              { ...marker.data }
            );

            // Force the correct size
            const tokenElement =
              newMarker.element.querySelector(".monster-token");
            if (tokenElement) {
              const styles = {
                width: `${scaledSize}px !important`,
                height: `${scaledSize}px !important`,
                borderRadius: "10%",
                border: "2px solid #f44336",
                overflow: "hidden",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                position: "absolute",
                left: `-${scaledSize / 2}px`,
                top: `-${scaledSize / 2}px`,
                transformOrigin: "center"
              };

              Object.assign(tokenElement.style, styles);
            }

            // Call updateMarkerAppearance but preserve our size
            this.mapEditor.updateMarkerAppearance(newMarker);

            // Re-apply size after updateMarkerAppearance
            if (tokenElement) {
              tokenElement.style.width = `${scaledSize}px`;
              tokenElement.style.height = `${scaledSize}px`;
              tokenElement.style.left = `-${scaledSize / 2}px`;
              tokenElement.style.top = `-${scaledSize / 2}px`;
            }

            return newMarker;
          } else {
            return this.mapEditor.addMarker(
              marker.type,
              marker.x + offset,
              marker.y + offset,
              { ...marker.data }
            );
          }
        }

        getMonsterTooltip(monster) {
          if (!monster) return "Unlinked Encounter";
          return `
            ${monster.basic.name}
            CR ${monster.basic.cr} (${monster.basic.xp} XP)
            HP: ${monster.stats.hp.average}
            AC: ${monster.stats.ac}
        `;
        }
      }
