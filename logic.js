/**
 * HITrack Logic - Mathematical Models for Heat Index Evaluation
 */

const HITrack = {
    /**
     * Calculates the Humidex (Canadian Index)
     * @param {number} temp - Temperature in Celsius
     * @param {number} humidity - Relative Humidity in percentage (0-100)
     * @returns {number} - Calculated Humidex
     */
    calculateHumidex: function(temp, humidity) {
        // Vapor pressure (e) calculation
        // e = 6.11 * exp(5417.7530 * (1/273.16 - 1/(273.15 + dewpoint)))
        // Simplification using RH:
        const e = (6.112 * Math.pow(10, (7.5 * temp) / (237.7 + temp)) * (humidity / 100));
        const humidex = temp + 0.5555 * (e - 10.0);
        return parseFloat(humidex.toFixed(1));
    },

    /**
     * Calculates the Steadman Model Heat Index (NWS Standard)
     * Uses the Rothfusz regression equation with adjustments.
     * @param {number} tempC - Temperature in Celsius
     * @param {number} humidity - Relative Humidity in percentage (0-100)
     * @returns {number} - Calculated Heat Index in Celsius
     */
    calculateSteadman: function(tempC, humidity) {
        // Convert to Fahrenheit for the standard formula
        const T = (tempC * 9/5) + 32;
        const R = humidity;

        // Base Heat Index calculation
        let hi = -42.379 + 2.04901523 * T + 10.14333127 * R - 0.22475541 * T * R - 
                 0.00683783 * Math.pow(T, 2) - 0.05481717 * Math.pow(R, 2) + 
                 0.00122874 * Math.pow(T, 2) * R + 0.00085282 * T * Math.pow(R, 2) - 
                 0.00000199 * Math.pow(T, 2) * Math.pow(R, 2);

        // Adjustments
        if (R < 13 && T >= 80 && T <= 112) {
            const adj = ((13 - R) / 4) * Math.sqrt((17 - Math.abs(T - 95)) / 17);
            hi -= adj;
        } else if (R > 85 && T >= 80 && T <= 87) {
            const adj = ((R - 85) / 10) * ((87 - T) / 5);
            hi += adj;
        }

        // Convert back to Celsius
        const hiC = (hi - 32) * 5/9;
        
        // Heat Index is only valid for temperatures above 80F (approx 26.7C)
        // If below, the Heat Index is roughly equal to the temperature
        return parseFloat((T < 80 ? tempC : hiC).toFixed(1));
    },

    /**
     * Determines the danger level based on Heat Index
     * @param {number} value - Calculated heat index
     * @returns {Object} - Level info {label, class}
     */
    getDangerLevel: function(value) {
        if (value < 30) return { label: 'Safe', class: 'safe', color: '#48bb78' };
        if (value < 35) return { label: 'Caution', class: 'caution', color: '#ecc94b' };
        if (value < 40) return { label: 'Extreme Caution', class: 'danger', color: '#ed8936' };
        if (value < 45) return { label: 'Danger', class: 'extreme', color: '#f56565' };
        return { label: 'Extreme Danger', class: 'deadly', color: '#9b2c2c' };
    }
};
