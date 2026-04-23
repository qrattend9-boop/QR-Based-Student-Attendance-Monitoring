# Smart Scan Attendance System

A modern, automated attendance tracking solution designed to streamline check-in processes using scanning technology. Built with **React** and powered by **Supabase**, this system provides a robust, scalable, and secure platform for managing attendance records in real-time.

## 🚀 Features

- **Instant Scanning**: High-speed scanning for rapid attendance logging and verification.
- **Real-time Synchronization**: Instant data updates across all devices and dashboards via Supabase.
- **Advanced Analytics**: Detailed reporting and insights into attendance trends and patterns.
- **Secure Data Management**: Enterprise-grade security with Row Level Security (RLS) and encrypted storage for user profiles.
- **Responsive UI**: A clean, mobile-friendly interface for a seamless experience on both desktop and mobile devices.
- **Vector Search Integration**: Potential for advanced identification using high-dimensional embeddings for verification.

## 🛠️ Tech Stack

- **Frontend**: React.js with modern hooks and state management.
- **Backend-as-a-Service**: Supabase (Database, Authentication, and Storage).
- **File Management**: `@humanfs/core` for efficient, runtime-agnostic file system operations.
- **Parsing**: Acorn for robust JavaScript parsing.
- **Testing**: React Testing Library and Jest for ensuring high-quality, maintainable code.

## 📋 Functionality

### For Administrators
- **Central Dashboard**: Monitor live attendance feeds, late entries, and total headcount.
- **Comprehensive Reporting**: Generate and export attendance reports for compliance or payroll.
- **Participant Management**: Easily manage the roster of users authorized to scan in.

### For Users
- **Quick Check-in/out**: Simple self-service scanning interface for immediate attendance logging.
- **Personal History**: Users can view their own attendance logs and status history.

## 🚦 Getting Started

1.  **Clone the repository**
2.  **Install dependencies**:
    ```bash
    npm install
    ```
3.  **Configure Environment**: Set up your `.env` file with your Supabase URL and Anon Key.
4.  **Launch the App**:
    ```bash
    npm run dev
    ```
