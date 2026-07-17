# Requirements Document

## Introduction

A web-based prize roulette wheel application that allows users to spin a wheel for a chance to win prizes. Users access the application by scanning a QR code, which opens the web page with an interactive spinning wheel. The wheel contains a configurable set of prizes and "no prize" segments. After the spin completes, a modal displays the result along with a call-to-action button directing users to follow the organization on Meetup to claim their prize.

## Glossary

- **Roulette_Wheel**: The interactive spinning wheel component displayed on the web page, containing multiple segments with prizes and no-prize options.
- **Segment**: A single section of the Roulette_Wheel representing either a prize or a no-prize outcome.
- **Prize**: A reward assigned to a Segment that a user can win by spinning the Roulette_Wheel.
- **No_Prize_Segment**: A Segment on the Roulette_Wheel that represents no reward for the user.
- **Result_Modal**: A dialog overlay that appears after the Roulette_Wheel stops spinning, displaying the outcome of the spin.
- **Spin_Action**: The user-initiated action that starts the Roulette_Wheel rotation.
- **QR_Code**: A scannable code that directs users to the web application URL.
- **Meetup_Button**: A call-to-action button inside the Result_Modal that links to the organization's Meetup page.
- **Web_Application**: The single-page web application hosting the Roulette_Wheel and all associated UI components.
- **Prize_Stock**: The quantity of available units for a specific Prize. Each time a user wins a Prize, the Prize_Stock decreases by one.
- **Admin_Panel**: A password-protected web interface that allows event organizers to manage prizes, stock levels, and configuration in real time.
- **QR_Display_Screen**: A separate web page designed for display on a TV or monitor at the event, showing the QR_Code and a live list of available prizes with remaining quantities.
- **Backend_Service**: The server-side application responsible for persisting prize data, managing stock, and broadcasting real-time updates to connected clients.
- **WebSocket_Connection**: A persistent bidirectional communication channel between the Backend_Service and connected clients (Web_Application, Admin_Panel, QR_Display_Screen) for real-time data synchronization.

## Requirements

### Requirement 1: Display the Roulette Wheel

**User Story:** As a user, I want to see an interactive roulette wheel on the page, so that I can understand the available prizes before spinning.

#### Acceptance Criteria

1. THE Web_Application SHALL display the Roulette_Wheel with all configured Segments visible on page load.
2. THE Roulette_Wheel SHALL display each Segment with a distinct color to differentiate prizes from one another.
3. THE Roulette_Wheel SHALL display the name of each prize or "Sin Premio" label within its corresponding Segment.
4. THE Roulette_Wheel SHALL include at least one No_Prize_Segment labeled "Sin Premio".

### Requirement 2: QR Code Access

**User Story:** As an event organizer, I want users to access the roulette wheel by scanning a QR code, so that I can easily direct attendees to the application.

#### Acceptance Criteria

1. THE Web_Application SHALL be accessible via a URL encoded in the QR_Code.
2. WHEN a user scans the QR_Code, THE Web_Application SHALL load the page with the Roulette_Wheel ready for interaction.
3. THE Web_Application SHALL be responsive and render correctly on mobile devices with screen widths from 320px to 768px.

### Requirement 3: Spin the Wheel

**User Story:** As a user, I want to spin the roulette wheel, so that I can receive a random prize outcome.

#### Acceptance Criteria

1. THE Web_Application SHALL display a spin button labeled "Girar" below the Roulette_Wheel.
2. WHEN the user activates the Spin_Action, THE Roulette_Wheel SHALL rotate with a spinning animation for a duration between 3 and 6 seconds.
3. WHEN the Spin_Action is activated, THE Web_Application SHALL disable the spin button to prevent multiple simultaneous spins.
4. THE Roulette_Wheel SHALL select a random Segment as the winning outcome for each Spin_Action.
5. WHEN the Roulette_Wheel stops spinning, THE Roulette_Wheel SHALL visually indicate the winning Segment with a pointer or marker.

### Requirement 4: Display Spin Result

**User Story:** As a user, I want to see the result of my spin clearly, so that I know what prize I won or if I didn't win.

#### Acceptance Criteria

1. WHEN the Roulette_Wheel stops spinning, THE Web_Application SHALL display the Result_Modal within 500 milliseconds.
2. THE Result_Modal SHALL display the name of the winning Prize or "Sin Premio" as the primary heading.
3. THE Result_Modal SHALL display a description or detail of the winning Prize when the outcome is a Prize.
4. WHEN the outcome is a No_Prize_Segment, THE Result_Modal SHALL display a consolation message encouraging the user to try again.

### Requirement 5: Meetup Call-to-Action

**User Story:** As an event organizer, I want the result modal to include a follow button for Meetup, so that users engage with our community to claim their prizes.

#### Acceptance Criteria

1. THE Result_Modal SHALL display the Meetup_Button with the text "Síguenos en Meetup para reclamar tu premio".
2. WHEN the user activates the Meetup_Button, THE Web_Application SHALL open the configured Meetup page URL in a new browser tab.
3. THE Result_Modal SHALL display the Meetup_Button regardless of whether the outcome is a Prize or a No_Prize_Segment.

### Requirement 6: Prize Configuration

**User Story:** As an event organizer, I want to configure the prizes on the wheel, so that I can customize the experience for different events.

#### Acceptance Criteria

1. THE Web_Application SHALL load the list of prizes and No_Prize_Segments from a configuration data source.
2. THE Web_Application SHALL support a minimum of 4 and a maximum of 12 Segments on the Roulette_Wheel.
3. Each Prize in the configuration SHALL include a name, a description, and a color property.
4. THE Web_Application SHALL assign equal angular size to each Segment on the Roulette_Wheel.

### Requirement 7: Visual Feedback and Animation

**User Story:** As a user, I want smooth and engaging animations, so that the spinning experience feels exciting and realistic.

#### Acceptance Criteria

1. WHEN the Spin_Action is activated, THE Roulette_Wheel SHALL accelerate from rest, maintain speed, and decelerate to a stop using an easing function.
2. THE Roulette_Wheel SHALL complete a minimum of 3 full rotations before stopping on the winning Segment.
3. WHILE the Roulette_Wheel is spinning, THE Web_Application SHALL display a visual indicator (such as a ticker sound effect or flashing pointer) to enhance the experience.

### Requirement 8: Close Result Modal

**User Story:** As a user, I want to close the result modal after viewing my result, so that I can return to the main page.

#### Acceptance Criteria

1. THE Result_Modal SHALL display a close button to dismiss the modal.
2. WHEN the user activates the close button, THE Web_Application SHALL hide the Result_Modal and return to the Roulette_Wheel view.
3. WHEN the Result_Modal is closed, THE Web_Application SHALL re-enable the spin button to allow a new Spin_Action.



### Requirement 9: Prize Inventory and Stock Management

**User Story:** As an event organizer, I want each prize to have a limited stock quantity, so that the wheel automatically adjusts when a prize runs out.

#### Acceptance Criteria

1. Each Prize in the configuration SHALL include a Prize_Stock value representing the number of available units.
2. WHEN a user wins a Prize, THE Backend_Service SHALL decrease the Prize_Stock for that Prize by exactly 1.
3. WHEN the Prize_Stock for a Prize reaches 0, THE Web_Application SHALL replace that Prize Segment with a No_Prize_Segment labeled "Sin Premio" on the Roulette_Wheel.
4. THE Backend_Service SHALL persist the current Prize_Stock for each Prize across page reloads and user sessions.
5. WHILE the Prize_Stock for a Prize is greater than 0, THE Roulette_Wheel SHALL display that Prize Segment as available.
6. THE Backend_Service SHALL prevent concurrent Spin_Actions from awarding a Prize whose Prize_Stock has already reached 0.

### Requirement 10: Admin Panel

**User Story:** As an event organizer, I want a password-protected admin interface, so that I can manage prizes and stock levels while the roulette is active for users.

#### Acceptance Criteria

1. THE Admin_Panel SHALL be accessible via a dedicated URL path separate from the user-facing Web_Application.
2. THE Admin_Panel SHALL require a password before granting access to administrative functions.
3. IF an incorrect password is provided, THEN THE Admin_Panel SHALL deny access and display an authentication error message.
4. THE Admin_Panel SHALL provide functionality to add a new Prize with a name, description, color, and Prize_Stock value.
5. THE Admin_Panel SHALL provide functionality to edit the name, description, color, and Prize_Stock of an existing Prize.
6. THE Admin_Panel SHALL provide functionality to remove an existing Prize from the Roulette_Wheel.
7. THE Admin_Panel SHALL display the current Prize_Stock for each Prize in real time.
8. WHEN an organizer modifies prizes through the Admin_Panel, THE Backend_Service SHALL persist the changes and broadcast updates to all connected clients.
9. WHILE the Web_Application is active for users, THE Admin_Panel SHALL allow organizers to manage prizes without interrupting user sessions.

### Requirement 11: QR Display Screen with Real-Time Prize List

**User Story:** As an event organizer, I want a dedicated display screen showing the QR code and available prizes, so that attendees at the event can see what they can win and how to participate.

#### Acceptance Criteria

1. THE QR_Display_Screen SHALL be accessible via a dedicated URL path separate from the user-facing Web_Application and the Admin_Panel.
2. THE QR_Display_Screen SHALL display the QR_Code that users scan to access the Web_Application.
3. THE QR_Display_Screen SHALL display a list of all available prizes with their names and remaining Prize_Stock quantities.
4. WHEN a user wins a Prize, THE QR_Display_Screen SHALL update the displayed Prize_Stock for that Prize within 2 seconds.
5. WHEN the Prize_Stock for a Prize reaches 0, THE QR_Display_Screen SHALL visually indicate that the Prize is no longer available.
6. THE QR_Display_Screen SHALL be optimized for large-screen display on TVs and monitors with a minimum viewport width of 1024px.
7. WHEN an organizer adds or removes a Prize via the Admin_Panel, THE QR_Display_Screen SHALL reflect the change within 2 seconds.

### Requirement 12: Backend Service and Real-Time Communication

**User Story:** As an event organizer, I want the application to persist data and synchronize state in real time, so that all connected screens reflect accurate prize availability.

#### Acceptance Criteria

1. THE Backend_Service SHALL persist all Prize data including name, description, color, and Prize_Stock to a data store.
2. THE Backend_Service SHALL expose a WebSocket_Connection endpoint for real-time communication with connected clients.
3. WHEN the Prize_Stock for any Prize changes, THE Backend_Service SHALL broadcast the updated Prize_Stock to all connected clients via the WebSocket_Connection within 1 second.
4. WHEN a Prize is added, edited, or removed via the Admin_Panel, THE Backend_Service SHALL broadcast the updated prize list to all connected clients via the WebSocket_Connection within 1 second.
5. THE Backend_Service SHALL provide a REST API for the Admin_Panel to perform create, read, update, and delete operations on Prizes.
6. THE Backend_Service SHALL validate that Prize_Stock values are non-negative integers before persisting changes.
7. IF the WebSocket_Connection is interrupted, THEN THE Web_Application SHALL attempt to reconnect automatically and synchronize the current state upon reconnection.
8. THE Backend_Service SHALL handle concurrent requests to ensure Prize_Stock is not decremented below 0.
