# Avatar Integration for zansti sardam institute AI Chatbot

## Overview
This document explains how the custom avatars have been integrated into the zansti sardam institute AI Chatbot interface using the provided image URL.

## Implementation Details

### 1. JavaScript Integration
The avatars have been added to all message types in the chatbot:
- User messages
- Bot messages
- Welcome message
- Typing indicators

Each avatar uses the same image URL for consistency:
`https://i.ibb.co/21jpMNhw/234421810-326887782452132-7028869078528396806-n-removebg-preview-1.png`

### 2. CSS Styling
The avatars have been styled with the following features:
- Circular shape with border-radius
- Responsive sizing that adapts to different screen sizes
- Smooth hover effects for interactivity
- Consistent shadowing for depth
- Proper sizing within message containers

### 3. Responsive Design
The avatars automatically adjust their size based on screen width:
- Desktop: 45px
- Tablet (768px and below): 40px
- Mobile (480px and below): 35px

### 4. Animation Effects
The avatars include several subtle animations:
- Continuous pulsing glow effect
- Rotation animation when loading
- Scale effect on hover
- Smooth transitions between states

## Technical Details

### HTML Structure
```html
<div class="avatar">
  <img src="avatar-url" alt="Bot/User Avatar" class="avatar-image">
</div>
```

### CSS Classes
- `.avatar`: Container for the avatar with sizing and animation
- `.avatar-image`: Styles the actual image with proper sizing and shape

### CSS Variables
- `--avatar-size`: Controls the avatar dimensions (responsive)

## Branding Considerations

The avatar integration maintains the institutional identity preference by:
1. Using the official zansti sardam institute avatar image
2. Ensuring consistent appearance across all message types
3. Making it responsive for all device sizes
4. Maintaining the color scheme of the overall design

## Future Enhancements

Potential improvements that could be made:
1. Add different avatars for user vs bot messages
2. Implement animated avatars for loading states
3. Add status indicators for the bot (online, typing, etc.)
4. Include fallback text avatars for failed image loads