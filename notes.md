Notes on CombatSystem.js:

Handles turn-based combat between player monsters and enemies
Takes partyManager and resourceManager as dependencies
Maintains combat state (initiative order, current turn, player/enemy parties)
Extensive UI rendering with dynamic styles and animations
Combat logic with ability system, damage calculation, and AI for enemies
Combo system for special abilities between monster types
Animation and visual effects for combat actions
Integration with relationship system from PartyManager

Notes on Storyboard.js:

Very basic skeleton for story triggers based on player position
Uses Maps and Sets for tracking story points and triggered stories
Simple overlay UI for displaying splash art and text
Simple serialization for saving/loading story state
Interfaces with resourceManager for splash art resources

This gives us a great starting point for building our node-based story editor. The Storyboard.js is quite minimal, which actually works in our favor since we can build on it without being constrained by existing complex logic.
For our story flow chart editor, we should:

Design a more robust Storyboard class to handle node-based story progression
Create a visual editor UI in an sl-drawer (similar to ComfyUI)
Define different node types:

Dialogue nodes
Choice nodes (player decisions)
Trigger nodes (position-based in the world)
Event nodes (call game functions like offerStarterMonster)
Condition nodes (check game state)
Combat nodes (start combat with specific enemies)
Reward nodes (give items, monsters, etc.)


Implement connections between nodes for flow control
Create a runtime engine to execute the story graph
Add serialization/deserialization for saving/loading