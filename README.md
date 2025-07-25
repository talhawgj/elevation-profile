# Elevation Profile Viewer

A Next.js application that allows users to draw lines on an interactive map and visualize elevation profiles along those lines in real-time.

## 🌟 Features

- **Interactive Map**: Powered by Mapbox GL JS with satellite imagery and 3D terrain
- **Line Drawing**: Draw custom routes directly on the map using drawing controls
- **Real-time Elevation Data**: Fetches elevation data from Open Elevation API
- **Dynamic Charts**: Interactive elevation profile charts using Recharts
- **Responsive Design**: Clean, responsive UI built with Tailwind CSS
- **TypeScript**: Fully typed codebase for better development experience

## 🚀 Technologies Used

- **Frontend Framework**: Next.js 15 with React 19
- **Mapping**: Mapbox GL JS and react-map-gl
- **Drawing Tools**: Mapbox GL Draw
- **Charts**: Recharts for elevation profile visualization
- **Geospatial Operations**: Turf.js for line interpolation and calculations
- **Styling**: Tailwind CSS 4
- **Language**: TypeScript
- **Elevation Data**: Open Elevation API

## 📋 Prerequisites

Before running this application, you need:

1. **Mapbox Access Token**: Sign up at [Mapbox](https://www.mapbox.com/) and obtain an access token
2. **Node.js**: Version 18 or higher
3. **npm/yarn/pnpm**: Package manager of your choice

## ⚙️ Installation

1. **Clone the repository**:
   ```bash
   git clone <repository-url>
   cd elevation-profile
   ```

2. **Install dependencies**:
   ```bash
   npm install
   # or
   yarn install
   # or
   pnpm install
   ```

3. **Set up environment variables**:
   Create a `.env.local` file in the root directory and add your Mapbox token:
   ```env
   NEXT_PUBLIC_MAPBOX_TOKEN=your_mapbox_access_token_here
   ```

4. **Run the development server**:
   ```bash
   npm run dev
   # or
   yarn dev
   # or
   pnpm dev
   ```

5. **Open your browser**:
   Navigate to [http://localhost:3000](http://localhost:3000)

## 🎯 How to Use

1. **Navigate the Map**: Use mouse controls to pan and zoom around the satellite map
2. **Draw a Line**: Click the line drawing tool and draw a route on the map
3. **View Elevation**: The elevation profile chart will automatically appear showing the terrain elevation along your drawn line
4. **Delete Lines**: Use the trash tool to remove drawn lines
5. **Interactive Chart**: Hover over the chart to see specific elevation values

## 🏗️ Project Structure

```
elevation-profile/
├── src/
│   ├── app/
│   │   ├── globals.css          # Global styles
│   │   ├── layout.tsx           # Root layout component
│   │   └── page.tsx             # Main application page
│   └── components/
│       ├── DrawControl.tsx      # Mapbox drawing controls
│       ├── ElevationChart.tsx   # Elevation profile chart component
│       └── MapComp.tsx          # Main map component
├── public/                      # Static assets
├── package.json                 # Project dependencies
├── next.config.ts              # Next.js configuration
├── tailwind.config.ts          # Tailwind CSS configuration
└── tsconfig.json               # TypeScript configuration
```

## 🔧 Key Components

### MapComp
The main map component that renders the Mapbox map with:
- Satellite imagery as the base layer
- 3D terrain visualization with DEM data
- Globe projection for better geographical context

### DrawControl
Handles line drawing functionality:
- Integrates Mapbox GL Draw with React
- Supports line creation and deletion
- Triggers elevation data fetching when lines are drawn

### ElevationChart
Displays elevation profiles:
- Uses Recharts for interactive visualization
- Shows elevation vs. distance along the drawn line
- Responsive overlay positioned on the map

## 🌐 API Integration

The application uses the [Open Elevation API](https://open-elevation.com/) to fetch elevation data:
- **Endpoint**: `https://api.open-elevation.com/api/v1/lookup`
- **Free to use**: No API key required
- **Input**: Coordinates in lat,lon format
- **Output**: Elevation data in meters

## 🔄 Data Processing

1. **Line Interpolation**: Uses Turf.js to interpolate drawn lines into 30 evenly spaced points
2. **Coordinate Transformation**: Converts map coordinates to API-compatible format
3. **Elevation Mapping**: Maps elevation data to chart-compatible format with distance indexing

## 📝 Available Scripts

- `npm run dev` - Start development server with Turbopack
- `npm run build` - Build the application for production
- `npm run start` - Start the production server
- `npm run lint` - Run ESLint for code quality checks

## 🛠️ Configuration

### Environment Variables
- `NEXT_PUBLIC_MAPBOX_TOKEN` - Your Mapbox access token (required)

### Map Configuration
The map is configured with:
- Initial view centered at coordinates (0, 0) with zoom level 3
- Satellite imagery style
- Globe projection for better visualization
- Terrain exaggeration factor of 1.5

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📄 License

This project is open source and available under the [MIT License](LICENSE).

## 🔗 Useful Links

- [Mapbox GL JS Documentation](https://docs.mapbox.com/mapbox-gl-js/)
- [Open Elevation API](https://open-elevation.com/)
- [Next.js Documentation](https://nextjs.org/docs)
- [Recharts Documentation](https://recharts.org/)
- [Turf.js Documentation](https://turfjs.org/)

## 🐛 Troubleshooting

### Common Issues

1. **Map not loading**: Ensure your Mapbox token is correctly set in `.env.local`
2. **Elevation data not showing**: Check browser console for API errors
3. **Build errors**: Ensure all dependencies are installed with `npm install`

### Performance Notes

- The application interpolates lines to 30 points to balance detail with API performance
- Large or complex drawings may take longer to process
- Consider implementing caching for frequently accessed elevation data

---

Built with ❤️ using Next.js and Mapbox